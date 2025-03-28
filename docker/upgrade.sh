#!/usr/bin/env sh
set -eu -o pipefail

# We do a --package-lock-only because we don't want to change the node_modules directory.
# This is because the existing node_modules directory may have been installed on a
# different platform since it is being volume mounted into a Linux container
/scripts/upgrade-connector.sh "${HASURA_PLUGIN_CONNECTOR_CONTEXT_PATH:-/functions}" "$(cat /scripts/CONNECTOR_VERSION)" "--package-lock-only"
echo "You may need to run 'npm install' to install the new dependencies locally"
