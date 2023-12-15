import { Command } from "commander"
import { version } from "../package.json"
import * as sdk from "@hasura/ndc-sdk-typescript";
import { ConnectorOptions, createConnector } from "./connector";

export function startHost(args: string[]) {
  const program = new Command();

  const serveCommand = sdk.get_serve_command();
  serveCommand.action((serverOptions: sdk.ServerOptions, command: Command) => {
    const hostOpts: ConnectorOptions = command.parent!.opts();
    sdk.start_server(createConnector(hostOpts), serverOptions)
  })

  const configurationServeCommand = sdk.get_serve_configuration_command();
  configurationServeCommand.commands.find(c => c.name() === "serve")?.action((serverOptions: sdk.ConfigurationServerOptions, command: Command) => {
    const hostOpts: ConnectorOptions = command.parent!.opts();
    sdk.start_configuration_server(createConnector(hostOpts), serverOptions)
  });

  program
    .name("ndc-functions-sdk-node")
    .version(version)
    .command("host")
    .requiredOption("-f, --functions <filepath>")
    .addCommand(serveCommand)
    .addCommand(configurationServeCommand);

  program.parseAsync(args).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
