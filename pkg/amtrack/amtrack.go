package amtrack

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/carlmjohnson/errutil"
	"github.com/carlmjohnson/flagext"
	"github.com/carlmjohnson/requests"
	"github.com/carlmjohnson/versioninfo"
	"github.com/huandu/xstrings"
	"github.com/ybbus/httpretry"
	"golang.org/x/oauth2/google"
	spreadsheet "gopkg.in/Iwark/spreadsheet.v2"
)

const AppName = "amtrack"

func init() {
	log.SetPrefix(AppName + " ")
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}

func CLI(args []string) error {
	var app appEnv
	err := app.ParseArgs(args)
	if err != nil {
		return err
	}
	if err = app.Exec(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
	}
	return err
}

func (app *appEnv) ParseArgs(args []string) error {
	fl := flag.NewFlagSet(AppName, flag.ContinueOnError)
	fl.Usage = func() {
		fmt.Fprintf(fl.Output(), `amtrack - %s



Usage:

	amtrack [options]

Options:
`, versioninfo.Version)
		fl.PrintDefaults()
	}
	fl.Func("sheet", "Google Sheet ID", func(s string) error {
		// https://stackoverflow.com/a/16840612/4893152
		re := regexp.MustCompile(`[-\w]{25,}`)
		if id := re.FindString(s); id != "" {
			app.SheetID = id
			return nil
		}
		return errors.New("could not parse ID for Google Sheet")
	})
	fl.Func("google-client-secret", "`base64 encoded JSON` of Google client secret", func(s string) error {
		var err error
		app.GoogleClientSecret, err = base64.StdEncoding.DecodeString(s)
		return err
	})
	fl.StringVar(&app.OpenStatesKey, "open-states-key", "", "API `key` for Open States")
	fl.Func("cache-dir", "request cache `directory path`", func(s string) error {
		if s == "-" {
			cachedir, err := os.UserCacheDir()
			if err != nil {
				return err
			}
			s = filepath.Join(cachedir, AppName)
		}
		app.CacheDir = s
		return nil
	})
	fl.DurationVar(&app.Delay, "delay", 1*time.Second, "delay between Open States requests")
	fl.StringVar(&app.Dest, "write", "amtrack.json", "destination `file path`")

	if err := fl.Parse(args); err != nil {
		return err
	}
	if err := flagext.ParseEnv(fl, AppName); err != nil {
		return err
	}
	if err := flagext.MustHave(fl, "sheet", "open-states-key"); err != nil {
		return err
	}
	return nil
}

type appEnv struct {
	SheetID            string
	GoogleClientSecret []byte
	OpenStatesKey      string
	CacheDir           string
	Delay              time.Duration
	Dest               string
}

func (app *appEnv) Exec() (err error) {
	defer errutil.Trace(&err)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	client, err := app.googleClient(ctx)
	if err != nil {
		return err
	}

	log.Println("getting sheet", app.SheetID)

	service := spreadsheet.NewServiceWithClient(client)
	doc, err := service.FetchSpreadsheet(app.SheetID)
	if err != nil {
		return err
	}

	if len(doc.Sheets) < 1 || len(doc.Sheets[0].Rows) < 1 {
		return fmt.Errorf("document %q is malformed", app.SheetID)
	}

	cl := httpretry.NewDefaultClient()
	if app.CacheDir != "" {
		log.Println("Using request cache", app.CacheDir)
		cl.Transport = requests.Caching(cl.Transport, app.CacheDir)
	}

	objs := makeObjects(doc.Sheets[0].Rows)

	for _, obj := range objs {
		if err = app.addOpenStatesData(ctx, cl, obj); err != nil {
			return err
		}
		wait := time.After(app.Delay)

		log.Println("writing", app.Dest)
		val := struct {
			Data interface{} `json:"data"`
		}{objs}
		data, err := json.MarshalIndent(val, "", "  ")
		if err != nil {
			return err
		}

		if err = os.WriteFile(app.Dest, data, 0644); err != nil {
			return err
		}
		select {
		case <-wait:
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return nil
}

func (app *appEnv) googleClient(ctx context.Context) (*http.Client, error) {
	if len(app.GoogleClientSecret) > 0 {
		log.Printf("using base64 Google credentials")
		conf, err := google.JWTConfigFromJSON(app.GoogleClientSecret, spreadsheet.Scope)
		if err != nil {
			return nil, fmt.Errorf("could not parse Google credentials: %v", err)
		}
		return conf.Client(ctx), nil
	}
	log.Print("using default Google credentials")
	client, err := google.DefaultClient(ctx, spreadsheet.Scope)
	if err != nil {
		return nil, fmt.Errorf("could not find Google credentials: %v", err)
	}
	return client, nil
}

func makeObjects(rows [][]spreadsheet.Cell) (objs []map[string]interface{}) {
	objs = make([]map[string]interface{}, 0, len(rows))
	headers := makeVals(rows[0])
	for i := range headers {
		headers[i] = xstrings.Delete(headers[i], "^A-Za-z ")
		headers[i] = xstrings.ToCamelCase(headers[i])
	}
	for i, row := range rows[1:] {
		vals := makeVals(row)
		if blank(vals) {
			continue
		}
		obj := makeObj(headers, vals)
		obj["RowID"] = i
		objs = append(objs, obj)
	}
	return objs
}

func blank(record []string) bool {
	for _, s := range record {
		if s != "" {
			return false
		}
	}
	return true
}

func makeVals(row []spreadsheet.Cell) []string {
	vals := make([]string, len(row))
	for _, cell := range row {
		vals = append(vals, strings.TrimSpace(cell.Value))
	}
	return vals
}

func makeObj(headers, vals []string) map[string]interface{} {
	obj := make(map[string]interface{}, len(headers))
	for i, key := range headers {
		obj[key] = vals[i]
	}
	delete(obj, "")
	return obj
}

func (app *appEnv) addOpenStatesData(ctx context.Context, cl *http.Client, obj map[string]interface{}) error {
	id, _ := obj["OpenStatesId"].(string)
	if id == "" {
		log.Println("no OpenStatesId; skipping", obj["BillNumber"])
		return nil
	}
	log.Println("fetching", id)
	var data OpenStatesBill
	err := requests.
		URL("https://v3.openstates.org/bills/").
		Param("include", "actions").
		Client(cl).
		Header("X-API-Key", app.OpenStatesKey).
		ToJSON(&data).
		Path(id).
		Fetch(ctx)
	if err != nil {
		return err
	}
	obj["OpenStatesInfo"] = data
	return nil
}
