#!/usr/bin/env node

// This JS file is a shim that uses ts-node to run index.ts

const spawn = require("cross-spawn");

const args = process.argv.slice(2);

const pathToSource = require.resolve("../src/index.ts");
const result = spawn.sync("ts-node", ["--transpileOnly", pathToSource, ...args], { stdio: "inherit" })
if (result.error) console.error(result.error);
process.exit(result.status);
