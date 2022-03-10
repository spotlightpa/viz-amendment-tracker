#!/bin/bash

set -eux -o pipefail

DATA_FILE="assets/json/amtrack.json"

function log() {
	echo >&2 "${*}"
}

go run ./cmd/amtrack -write "$DATA_FILE"

export GIT_COMMITTER_NAME="Automated"
export GIT_COMMITTER_EMAIL="actions@users.noreply.github.com"
export GIT_AUTHOR_NAME=$GIT_COMMITTER_NAME
export GIT_AUTHOR_EMAIL=$GIT_COMMITTER_EMAIL

git add "$DATA_FILE"
git commit -m "Latest data: $(date -u)" || (
	log "No change"
	exit 0
)
git fetch
git rebase
git push
