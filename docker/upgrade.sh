#!/usr/bin/env sh
set -eu -o pipefail

/scripts/upgrade-connector.sh "${HASURA_PLUGIN_CONNECTOR_CONTEXT_PATH:-/functions}" "$(cat /scripts/CONNECTOR_VERSION)" "--package-lock-only"
echo "You may need to run 'npm install' to install the new dependencies locally"
