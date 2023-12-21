#!/usr/bin/env sh
set -eu -o pipefail

/scripts/package-restore.sh

cd /functions
exec npm start
