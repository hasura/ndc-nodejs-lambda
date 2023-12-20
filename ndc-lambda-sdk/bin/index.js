#!/usr/bin/env node

// This JS file is a shim that uses ts-node execute the host, but in the context
// of the current directory which is expected to contain the user's hosted code
// so ts-node will use their compiler settings

const spawn = require("cross-spawn");

const script = `require("@hasura/ndc-lambda-sdk/host").startHost(${JSON.stringify(process.argv)})`
const result = spawn.sync("ts-node", ["--cwdMode", "--transpile-only", "-e", script], { stdio: "inherit" })
if (result.error) console.error(result.error);
process.exit(result.status);
