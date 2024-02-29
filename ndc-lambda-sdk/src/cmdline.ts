import { Command, Option } from "commander"
import { version } from "../package.json"
import * as sdk from "@hasura/ndc-sdk-typescript";

export type HostOptions = {
  functions: string
  watch: boolean
}

export interface CommandActions {
  serveAction(hostOpts: HostOptions, serverOpts: sdk.ServerOptions): Promise<void> | void
}

export function makeCommand(commandActions: CommandActions): Command {
  const program = new Command()
    .name("ndc-lambda-sdk")
    .version(version);

  const serveCommand = sdk.getServeCommand();
  serveCommand.action((serverOptions: sdk.ServerOptions, command: Command) => {
    const hostOpts: HostOptions = hostCommand.opts();
    return commandActions.serveAction(hostOpts, serverOptions);
  })

  const hostCommand = program
    .command("host")
    .addOption(
      new Option("--watch", "watch for configuration changes and reload")
        .default(false)
        .env("WATCH")
    )
    .requiredOption("-f, --functions <filepath>", "path to your TypeScript functions file")
    .addCommand(serveCommand);

  return program;
}
