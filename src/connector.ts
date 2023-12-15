import sdk from "@hasura/ndc-sdk-typescript";
import { JSONSchemaObject } from "@json-schema-tools/meta-schema";
import path from "node:path"

export type RawConfiguration = {};
export type Configuration = {};

export type State = {
  functions: RuntimeFunctions
}

export type RuntimeFunctions = {
  [function_name: string]: Function
}

export const RAW_CONFIGURATION_SCHEMA: JSONSchemaObject = {
  description: 'NodeJS Functions SDK Connector Configuration',
  type: 'object',
  required: [],
  properties: {}
};

export type ConnectorOptions = {
  functions: string
}

export function createConnector(options: ConnectorOptions): sdk.Connector<RawConfiguration, Configuration, State> {

  const connector: sdk.Connector<RawConfiguration, Configuration, State> = {
    get_raw_configuration_schema: function (): JSONSchemaObject {
      return RAW_CONFIGURATION_SCHEMA;
    },
    make_empty_configuration: function (): RawConfiguration {
      return {};
    },
    update_configuration: async function (rawConfiguration: RawConfiguration): Promise<RawConfiguration> {
      return {};
    },
    validate_raw_configuration: async function (rawConfiguration: RawConfiguration): Promise<Configuration> {
      return {};
    },
    try_init_state: async function (configuration: Configuration, metrics: unknown): Promise<State> {
      const resolvedPath = path.resolve(options.functions);
      const functions = require(resolvedPath);
      return {
        functions
      }
    },
    get_capabilities: function (configuration: Configuration): sdk.CapabilitiesResponse {
      return {
        versions: "^0.1.0",
        capabilities: {
          query: {},
        }
      };
    },
    get_schema: function (configuration: Configuration): Promise<sdk.SchemaResponse> {
      throw new Error("Function not implemented.");
    },
    query: function (configuration: Configuration, state: State, request: sdk.QueryRequest): Promise<sdk.QueryResponse> {
      throw new Error("Function not implemented.");
    },
    mutation: function (configuration: Configuration, state: State, request: sdk.MutationRequest): Promise<sdk.MutationResponse> {
      throw new Error("Function not implemented.");
    },
    explain: function (configuration: Configuration, state: State, request: sdk.QueryRequest): Promise<sdk.ExplainResponse> {
      throw new Error("Function not implemented.");
    },
    health_check: async function (configuration: Configuration, state: State): Promise<undefined> {
      return undefined;
    },
    fetch_metrics: async function (configuration: Configuration, state: State): Promise<undefined> {
      return undefined;
    },
  }

  return connector;
}
