import * as sdk from "@hasura/ndc-sdk-typescript";
import { JSONSchemaObject } from "@json-schema-tools/meta-schema";
import path from "node:path"
import { FunctionsSchema, getNdcSchema, printRelaxedTypesWarning } from "./schema";
import { deriveSchema, printCompilerDiagnostics, printFunctionIssues } from "./inference";
import { RuntimeFunctions, executeMutation, executeQuery } from "./execution";

export type RawConfiguration = {};
export type Configuration = {
  functionsSchema: FunctionsSchema
};

export type State = {
  runtimeFunctions: RuntimeFunctions
}

export const RAW_CONFIGURATION_SCHEMA: JSONSchemaObject = {
  description: 'NodeJS Lambda SDK Connector Configuration',
  type: 'object',
  required: [],
  properties: {}
};

export type ConnectorOptions = {
  functionsFilePath: string
}

export function createConnector(options: ConnectorOptions): sdk.Connector<RawConfiguration, Configuration, State> {
  const functionsFilePath = path.resolve(options.functionsFilePath);

  const connector: sdk.Connector<RawConfiguration, Configuration, State> = {
    getRawConfigurationSchema: function (): JSONSchemaObject {
      return RAW_CONFIGURATION_SCHEMA;
    },

    makeEmptyConfiguration: function (): RawConfiguration {
      return {};
    },

    updateConfiguration: async function (rawConfiguration: RawConfiguration): Promise<RawConfiguration> {
      return {};
    },

    validateRawConfiguration: async function (rawConfiguration: RawConfiguration): Promise<Configuration> {
      const schemaResults = deriveSchema(functionsFilePath);
      printCompilerDiagnostics(schemaResults.compilerDiagnostics);
      printFunctionIssues(schemaResults.functionIssues);
      printRelaxedTypesWarning(schemaResults.functionsSchema);
      return {
        functionsSchema: schemaResults.functionsSchema
      }
    },

    tryInitState: async function (configuration: Configuration, metrics: unknown): Promise<State> {
      if (Object.keys(configuration.functionsSchema.functions).length === 0) {
        // If there are no declared functions, don't bother trying to load the code.
        // There's very likely to be compiler errors during schema inference that will
        // block the load anyway, or the user hasn't written anything useful yet.
        return { runtimeFunctions: {} }
      }
      return { runtimeFunctions: require(functionsFilePath) }
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
      return await executeQuery(request, configuration.functionsSchema, state.runtimeFunctions);
    },

    mutation: async function (configuration: Configuration, state: State, request: sdk.MutationRequest): Promise<sdk.MutationResponse> {
      return await executeMutation(request, configuration.functionsSchema, state.runtimeFunctions);
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
