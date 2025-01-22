#!/usr/bin/env sh
set -eu -o pipefail

connector_path="${HASURA_PLUGIN_CONNECTOR_CONTEXT_PATH:-/functions}"
target_connector_version="$(cat /scripts/CONNECTOR_VERSION)"

cd "$connector_path"

set +e
existing_connector_version=$(jq '.dependencies["@hasura/ndc-lambda-sdk"]' -r package.json)
exit_status=$?
if [ $exit_status -ne 0 ]; then
  echo "Unable to read the @hasura/ndc-lambda-sdk version from your package.json"
  echo "Please manually upgrade the @hasura/ndc-lambda-sdk package in your package.json to version $target_connector_version"
  exit 1
fi

if [ $existing_connector_version = "null" ]; then
  # This is very strange, their package.json must have the SDK installed but doesn't
  # We'll roll with it and just install the package
  echo "Missing the @hasura/ndc-lambda-sdk package in your package.json. Installing version $target_connector_version"
else
  echo "Upgrading @hasura/ndc-lambda-sdk package from version $existing_connector_version to version $target_connector_version"
fi

# We do a --package-lock-only because we don't want to change the node_modules directory.
# This is because the existing node_modules directory  may have been installed on a
# different platform since it is being volume mounted into a Linux container
npm install "@hasura/ndc-lambda-sdk@$target_connector_version" --save-exact --no-update-notifier --package-lock-only
exit_status=$?
set -e

if [ $exit_status -ne 0 ]; then
  echo "Failed to upgrade @hasura/ndc-lambda-sdk package to version $target_connector_version"
  echo "Please manually upgrade the @hasura/ndc-lambda-sdk package in your package.json to version $target_connector_version"
  exit 1
fi

echo "Successfully upgraded @hasura/ndc-lambda-sdk package to version $target_connector_version"
echo "You may need to run 'npm install' to install the new dependencies locally"
