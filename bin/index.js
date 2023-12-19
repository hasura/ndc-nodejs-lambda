#!/usr/bin/env node

// This JS file is a shim that uses ts-node to run index.ts

const spawn = require("cross-spawn");

const script = `require("@hasura/ndc-lamdba-sdk-node/host").startHost(${JSON.stringify(process.argv)})`
const result = spawn.sync("ts-node", ["--cwdMode", "--transpile-only", "-e", script], { stdio: "inherit" })
if (result.error) console.error(result.error);
process.exit(result.status);
