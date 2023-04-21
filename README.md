# Spotlight PA Amendment Tracker

### Installation

- Install Go. See .go-version for minimum version.
- Install Hugo. See netlify.toml for minimum version.
- Run `yarn` to install JavaScript dependencies. See netlify.toml for minimum version.

## Architecture

There is a Google Sheet containing the rows for the ammendments being considered by the PA State Legislature.

`go run ./cmd/amtrack` is a Go script to download that sheet, connect to the Open States API for supplemental data about the bills, and write out assets/json/amtrack.json with an organized view of the data.

Hugo looks at amtrack.json and uses it to build a static site based on that data.

Github Actions has a workflow called scrape.yml which runs every 6 hours to trigger a run of the amtrack script and save any changes to amtrack.json to git.

When the main branch of the Github repo changes, Netlify deploys a new build.

## Usage

### Required secrets

- Google Sheet URL

- [Open State API key](https://docs.openstates.org/api-v3/)

- Google Cloud Platform Service Account is like a user with a weird email address. If you share your Document or Drive with that email address, then the service account can access them. Service Account credentials are created at https://console.cloud.google.com/iam-admin/serviceaccounts. The credential consists of a JSON file containing a x509 certificate private key. See https://developers.google.com/accounts/docs/application-default-credentials for more.

    If -google-client-secret is specified, it must be a base64 encoded version of application_default_credentials.json because the '\n' in the JSON is often mangled by the environment.

### Command line options for Amtrack

```
  -cache-dir directory path
        request cache directory path
  -delay duration
        delay between Open States requests (default 1s)
  -google-client-secret base64 encoded JSON
        base64 encoded JSON of Google client secret
  -open-states-key key
        API key for Open States
  -sheet value
        Google Sheet ID
  -write file path
        destination file path (default "amtrack.json")
```

### Embed code

The production embed code is:

```html
<script src="https://viz-amendment-tracker.data.spotlightpa.org/embed.js" defer></script><div data-spl-interactive="viz-amendment-tracker"></div><small><a href="https://viz-amendment-tracker.data.spotlightpa.org">Click here if you have trouble loading this visualization</a></small>
```

Alternative embed codes can be tested by changing the script URL.
