#!/usr/bin/env bash
set -eu -o pipefail

/scripts/package-restore.sh

cd /functions

# Read the npm start script from package.json then exec it to ensure that
# it is the root process in the container, so that signals (ie SIGTERM)
# are propagated properly. "npm start" does not propagate SIGTERM to the
# actual started process
START_CMD=$(jq -r ".scripts.start" "package.json")
PATH=$PATH:/functions/node_modules/.bin exec $START_CMD
