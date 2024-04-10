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
      // changed we reload. If the files fail to compile, ts-node will print the diagnostic errors on the
      // terminal for us
      let runtimeFunctions: RuntimeFunctions | undefined = undefined;
      try {
        runtimeFunctions = require(functionsFilePath);
      } catch (e) {
        console.error(`${e}`); // Print the compiler errors produced by ts-node
        runtimeFunctions = undefined;
      }

      // If the functions successfully loaded (ie. compiled), let's derive the schema.
      // Unfortunately this means we've typechecked everything twice, but that seems unavoidable without
      // implementing our own hot-reloading system instead of using ts-node-dev.
      if (runtimeFunctions !== undefined) {
        const schemaResults = deriveSchema(functionsFilePath);
        printCompilerDiagnostics(schemaResults.compilerDiagnostics); // Should never have any of these, since we've already tried compiling the code above
        printFunctionIssues(schemaResults.functionIssues);
        printRelaxedTypesWarning(schemaResults.functionsSchema);

        return {
          functionsSchema: schemaResults.functionsSchema,
          runtimeFunctions,
        }
      }
      // If the functions did not compile, just have an empty schema, the user will need to correct
      // their code before we can derive a schema
      else {
        return {
          functionsSchema: {
            functions: {},
            objectTypes: {},
            scalarTypes: {},
          },
          runtimeFunctions: {}
        }
      }
    },

    tryInitState: async function (configuration: Configuration, metrics: unknown): Promise<State> {
      return {};
    },

    getCapabilities: function (configuration: Configuration): sdk.CapabilitiesResponse {
      return {
        version: "0.1.0",
        capabilities: {
          query: {
            variables: {}
          },
          mutation: {},
        }
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

    healthCheck: async function (configuration: Configuration, state: State): Promise<undefined> {
      return undefined;
    },

    fetchMetrics: async function (configuration: Configuration, state: State): Promise<undefined> {
      return undefined;
    },
  }

  return connector;
}
