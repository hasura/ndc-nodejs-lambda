#!/usr/bin/env bash
set -eu -o pipefail

./check-reqs.sh

cd $HASURA_PLUGIN_CONNECTOR_CONTEXT_PATH
npm run watch
