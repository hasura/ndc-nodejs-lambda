import * as sdk from "@hasura/ndc-sdk-typescript";
import { createConnector } from "./connector";
import { makeCommand } from "./cmdline";

const program = makeCommand({
  serveAction: (hostOpts, serveOpts) => sdk.startServer(createConnector({functionsFilePath: hostOpts.functions}), serveOpts),
});

program.parseAsync().catch(err => {
  console.error(err);
  process.exit(1);
});
