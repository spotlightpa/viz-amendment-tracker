package main

import (
	"os"

	"github.com/carlmjohnson/exitcode"
	"github.com/spotlightpa/viz-amendment-tracker/pkg/amtrack"
)

func main() {
	exitcode.Exit(amtrack.CLI(os.Args[1:]))
}
