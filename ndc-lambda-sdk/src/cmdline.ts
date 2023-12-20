import { Command } from "commander"
import { version } from "../package.json"
import * as sdk from "@hasura/ndc-sdk-typescript";

export type HostOptions = {
  functions: string
}

export interface CommandActions {
  serveAction(hostOpts: HostOptions, serverOpts: sdk.ServerOptions): Promise<void> | void
  configurationServeAction(hostOpts: HostOptions, serverOpts: sdk.ConfigurationServerOptions): Promise<void> | void
}

export function makeCommand(commandActions: CommandActions): Command {
  const program = new Command()
    .name("ndc-lamdba-sdk")
    .version(version);

  const serveCommand = sdk.get_serve_command();
  serveCommand.action((serverOptions: sdk.ServerOptions, command: Command) => {
    const hostOpts: HostOptions = hostCommand.opts();
    return commandActions.serveAction(hostOpts, serverOptions);
  })

  const configurationServeCommand = sdk.get_serve_configuration_command();
  configurationServeCommand.commands.find(c => c.name() === "serve")?.action((serverOptions: sdk.ConfigurationServerOptions, command: Command) => {
    const hostOpts: HostOptions = hostCommand.opts();
    return commandActions.configurationServeAction(hostOpts, serverOptions);
  });

  const hostCommand = program
    .command("host")
    .requiredOption("-f, --functions <filepath>")
    .addCommand(serveCommand)
    .addCommand(configurationServeCommand);

  return program;
}
