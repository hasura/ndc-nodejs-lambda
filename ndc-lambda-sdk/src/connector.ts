import * as sdk from "@hasura/ndc-sdk-typescript";
import path from "node:path"
import { FunctionsSchema, getNdcSchema, printRelaxedTypesWarning } from "./schema";
import { deriveSchema, printCompilerDiagnostics, printFunctionIssues } from "./inference";
import { RuntimeFunctions, executeMutation, executeQuery } from "./execution";

export type Configuration = {
  functionsSchema: FunctionsSchema
  runtimeFunctions: RuntimeFunctions
};

export type State = {}

export type ConnectorOptions = {
  functionsFilePath: string
}

export function createConnector(options: ConnectorOptions): sdk.Connector<Configuration, State> {
  const functionsFilePath = path.resolve(options.functionsFilePath);

  const connector: sdk.Connector<Configuration, State> = {

    parseConfiguration: async function (configurationDir: string): Promise<Configuration> {
      // We need to try imporing the functions code via require before doing schema inference because
      // during watch mode we need it to be registered in the watching system so when the files are
      // changed we reload. If the files fail to compile, require with throw and the exception will
      // result in the diagnostic errors being printed on the terminal for us
      let runtimeFunctions: RuntimeFunctions = require(functionsFilePath);;

      // If the functions successfully loaded (ie. compiled), let's derive the schema.
      // Unfortunately this means we've typechecked everything twice, but that seems unavoidable without
      // implementing our own hot-reloading system instead of using ts-node-dev.
      const schemaResults = deriveSchema(functionsFilePath);
      printCompilerDiagnostics(schemaResults.compilerDiagnostics); // Should never have any of these, since we've already tried compiling the code above
      printFunctionIssues(schemaResults.functionIssues);
      printRelaxedTypesWarning(schemaResults.functionsSchema);

      return {
        functionsSchema: schemaResults.functionsSchema,
        runtimeFunctions,
      }
    },

    tryInitState: async function (configuration: Configuration, metrics: unknown): Promise<State> {
      return {};
    },

    getCapabilities: function (configuration: Configuration): sdk.Capabilities {
      return {
        query: {
          variables: {},
          nested_fields: {},
        },
        mutation: {},
      };
    },

    getSchema: async function (configuration: Configuration): Promise<sdk.SchemaResponse> {
      return getNdcSchema(configuration.functionsSchema);
    },

    query: async function (configuration: Configuration, state: State, request: sdk.QueryRequest): Promise<sdk.QueryResponse> {
      return await executeQuery(request, configuration.functionsSchema, configuration.runtimeFunctions);
    },

    mutation: async function (configuration: Configuration, state: State, request: sdk.MutationRequest): Promise<sdk.MutationResponse> {
      return await executeMutation(request, configuration.functionsSchema, configuration.runtimeFunctions);
    },

    queryExplain: function (configuration: Configuration, state: State, request: sdk.QueryRequest): Promise<sdk.ExplainResponse> {
      throw new Error("Function not implemented.");
    },

    mutationExplain: function (configuration: Configuration, state: State, request: sdk.MutationRequest): Promise<sdk.ExplainResponse> {
      throw new Error("Function not implemented.");
    },

    fetchMetrics: async function (configuration: Configuration, state: State): Promise<undefined> {
      return undefined;
    },
  }

  return connector;
}
