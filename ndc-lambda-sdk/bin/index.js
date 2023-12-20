#!/usr/bin/env node

// This JS file is a shim that uses ts-node or ts-node-dev (for watch mode) to execute the host
// script that loads the user's functions

const spawn = require("cross-spawn");
const path = require("node:path");
const ts = require("typescript");
const { makeCommand } = require("../dist/src/cmdline")

// Parse the command line arguments but don't actually do anything.
// We need to get at the user's specified typescript functions file path early here in this shim
// so that we can search for their tsconfig in order to configure ts-node/ts-node-dev properly
const program = makeCommand({
  serveAction: () => {},
  configurationServeAction: () => {}
})
program.parse();

const hostOpts = program.commands.find(c => c.name() === "host")?.opts();
const tsConfigFileLocation = hostOpts?.functions ? ts.findConfigFile(path.dirname(hostOpts.functions), ts.sys.fileExists) : undefined;

const hostScriptPath = path.resolve(__dirname, "../dist/src/host.js")
const projectArgs = tsConfigFileLocation ? ["--project", tsConfigFileLocation] : []
const tsNodeArgs = [...projectArgs, "--transpile-only", hostScriptPath, ...process.argv.slice(2)];

const [command, args] =
  process.env["WATCH"] === "1"
    ? ["ts-node-dev", ["--respawn", ...tsNodeArgs]]
    : ["ts-node", tsNodeArgs]

const result = spawn.sync(command, args, { stdio: "inherit" })
if (result.error) console.error(result.error);
process.exit(result.status ?? undefined);
