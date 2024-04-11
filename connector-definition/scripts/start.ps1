$ErrorActionPreference = "Stop"

& ./check-reqs.ps1

Set-Location $env:HASURA_PLUGIN_CONNECTOR_CONTEXT_PATH
& npm run start
