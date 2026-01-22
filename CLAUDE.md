# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The ndc-nodejs-lambda connector exposes TypeScript functions as NDC (Native Data Connector) functions/procedures for Hasura DDN subgraphs. It automatically derives NDC schemas from TypeScript function signatures and JSDoc annotations.

## Repository Structure

- **ndc-lambda-sdk/**: Main npm package (`@hasura/ndc-lambda-sdk`) containing:
  - `src/inference.ts`: TypeScript AST analysis for schema derivation (core logic)
  - `src/execution.ts`: Query/mutation execution with parallel execution support
  - `src/connector.ts`: NDC connector implementation
  - `src/host.ts`: Host initialization and telemetry setup
  - `src/schema.ts`: Schema type definitions
  - `test/`: Mocha tests for inference, execution, and schema
- **connector-definition/**: Template and build configuration for connector distribution
  - `template/`: Starter template with example `functions.ts`
  - `Makefile`: Builds `connector-definition.tgz` for registry
- **docker/**: Runtime scripts for Docker container startup

## Commands

All commands run from `ndc-lambda-sdk/` directory:

```bash
npm run build    # Compile TypeScript (tsc)
npm test         # Run Mocha test suite
npm run start    # Build and start connector
```

Build connector definition (from `connector-definition/`):
```bash
make build       # Creates connector-definition.tgz
make clean       # Remove dist/
```

## Architecture

### Schema Inference Flow
1. TypeScript compiler parses `functions.ts` and validates types
2. `inference.ts` uses TS compiler API + `ts-api-utils` to analyze exported functions
3. JSDoc tags (`@readonly`, `@paralleldegree`, `@allowrelaxedtypes`) control behavior
4. Schema generation produces `FunctionsSchema` for NDC spec

### Function Exposure
- `@readonly` tag → NDC Function (GraphQL query)
- No tag → NDC Procedure (GraphQL mutation)
- `@paralleldegree N` → Limits parallel execution (default: 10)
- `@allowrelaxedtypes` → Allows otherwise unsupported types as opaque scalars

### Supported Types
Scalars: `string`, `number`, `boolean`, `bigint`, `Date`, `sdk.JSONValue`
Compound: Objects, interfaces, arrays (single type)
Optional: `?` parameters, `| null`, `| undefined` unions

### Unsupported Types (unless @allowrelaxedtypes)
Union types (except null/undefined), tuples, classes, Maps, enums, index signatures, function types, void/object/unknown/never/any

## Testing

Tests use Mocha + Chai. Test files in `ndc-lambda-sdk/test/`:
- `inference/`: Schema derivation tests
- `execution/`: Query/mutation execution tests
- `schema/`: NDC schema validation tests

## Key Dependencies

- `@hasura/ndc-sdk-typescript`: NDC specification SDK
- `ts-api-utils`: TypeScript AST utilities for type analysis
- `p-limit`: Parallel execution control
- `@hasura/ts-node-dev`: Watch mode with hot reload

## Environment Variables

- `HASURA_CONNECTOR_PORT`: Listen port (default: 8080)
- `WATCH`: Enable watch mode
- `OTEL_EXPORTER_OTLP_PROTOCOL`: OpenTelemetry export (http/protobuf or grpc)

## Version Synchronization

Connector definition version is derived from `ndc-lambda-sdk/package.json`. When releasing:
1. Update version in `ndc-lambda-sdk/package.json`
2. Update `CHANGELOG.md`
3. Create git tag `v<version>`
4. GitHub Actions publishes to npm and builds Docker images
