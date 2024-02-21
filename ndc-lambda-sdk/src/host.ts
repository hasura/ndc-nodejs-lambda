// We must initialize OpenTelemetry instrumentation before importing any other module
import * as sdkInstrumentation from "@hasura/ndc-sdk-typescript/instrumentation";
sdkInstrumentation.initTelemetry("ndc-lambda-sdk");

import * as sdk from "@hasura/ndc-sdk-typescript";
import { createConnector } from "./connector";
import { makeCommand } from "./cmdline";

const program = makeCommand({
  serveAction: (hostOpts, serveOpts) => sdk.start_server(createConnector({functionsFilePath: hostOpts.functions}), serveOpts),
  configurationServeAction: (hostOpts, serveOpts) => sdk.start_configuration_server(createConnector({functionsFilePath: hostOpts.functions}), serveOpts),
});

program.parseAsync().catch(err => {
  console.error(err);
  process.exit(1);
});
