# Node.js Lambda Connector Changelog
This changelog documents the changes between release versions.

## [Unreleased]
Changes to be included in the next upcoming release

## [1.12.0] - 2025-03-21
- Updated to use [TypeScript v5.8.2](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/) ([#53](https://github.com/hasura/ndc-nodejs-lambda/pull/53))
- Updated `cross-spawn` dependency to resolve [security vulnerability](https://www.cve.org/CVERecord?id=CVE-2024-21538) ([#53](https://github.com/hasura/ndc-nodejs-lambda/pull/53))

## [1.11.0] - 2025-01-22

### Added
- The connector now supports being upgraded with the forthcoming `ddn connector upgrade` command ([#51](https://github.com/hasura/ndc-nodejs-lambda/pull/51))

### Changed
- Updated to use [TypeScript v5.7.3](https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/) ([#52](https://github.com/hasura/ndc-nodejs-lambda/pull/52))

## [1.10.0] - 2024-11-21
- The connector now exits during startup if there are compiler errors in the functions code. The compiler errors are printed to stderr. Previously the connector would print the errors and start "successfully", but with an empty schema. The new behaviour ensures that when the connector is used with `ddn connector introspect`, `ddn` is aware that a problem has occurred (because the connector fails to start) and will prompt the user to print the logs to see the compiler errors. ([#50](https://github.com/hasura/ndc-nodejs-lambda/pull/50))

## [1.9.0] - 2024-10-24

### Added
- Exported the `@hasura/ndc-lambda-sdk/connector` module to make it easier to build entirely new connectors that extend the existing functionality provided by the SDK ([#45](https://github.com/hasura/ndc-nodejs-lambda/pull/45))

### Changed
* Updated to use [TypeScript v5.6.3](https://devblogs.microsoft.com/typescript/announcing-typescript-5-6/) ([#46](https://github.com/hasura/ndc-nodejs-lambda/pull/46))

## [1.8.0] - 2024-09-20
- Updated the NDC TypeScript SDK to v7.0.0 ([#44](https://github.com/hasura/ndc-nodejs-lambda/pull/44))
  - Added support for exporting OpenTelemetry traces and metrics over GRPC. A new environment variable `OTEL_EXPORTER_OTLP_PROTOCOL` lets you switch between `http/protobuf` and `grpc`.
  - By default OpenTelemetry is now exported over GRPC to `http://localhost:4317`.
  - To return to the old defaults, set the following environment variables:
    - `OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"`
    - `OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"`

## [1.7.0] - 2024-08-27
- Added `documentationPage` to the connector metadata to enable the `ddn` CLI to suggest documentation to users ([#41](https://github.com/hasura/ndc-nodejs-lambda/pull/41))
- Added multi-platform support to the `hasura/ndc-nodejs-lambda` docker image. It now supports both linux/amd64 and linux/arm64 platforms ([#42](https://github.com/hasura/ndc-nodejs-lambda/pull/42))
- Updated the NDC TypeScript SDK to v6.1.0 ([#43](https://github.com/hasura/ndc-nodejs-lambda/pull/43))
  - Support for [querying nested collections](https://hasura.github.io/ndc-spec/specification/queries/filtering.html#nested-collections) inside an EXISTS expression in a predicate
- Use a [Hasura-forked version](https://github.com/hasura/ts-node-dev) of [ts-node-dev](https://github.com/wclr/ts-node-dev) (used for hot-reloading in watch mode) to upgrade deprecated dependencies ([#43](https://github.com/hasura/ndc-nodejs-lambda/pull/43))

## [1.6.0] - 2024-08-08
- Updated the NDC TypeScript SDK to v6.0.0 ([#39](https://github.com/hasura/ndc-nodejs-lambda/pull/39))
  - The `/health` endpoint is now unauthenticated
- Updated TypeScript to v5.5.4 ([#39](https://github.com/hasura/ndc-nodejs-lambda/pull/39))

## [1.5.0] - 2024-07-30
- Updated the NDC TypeScript SDK to v5.2.0 ([#38](https://github.com/hasura/ndc-nodejs-lambda/pull/38))
  - The connector now listens on both ipv4 and ipv6 interfaces

## [1.4.1] - 2024-06-06
- Added a default .gitignore that ignores node_modules in the connector template ([#34](https://github.com/hasura/ndc-nodejs-lambda/pull/34))
- Updated the NDC TypeScript SDK to v5.0.0 ([#35](https://github.com/hasura/ndc-nodejs-lambda/pull/35))
  - The BigInt scalar type now uses the biginteger type representation
- Added `dotenv-cli` to the dev dependencies of the connector's default package.json to help with using .env files ([#36](https://github.com/hasura/ndc-nodejs-lambda/pull/36))

## [1.4.0] - 2024-05-08
- Removed type inference recursion limit ([#33](https://github.com/hasura/ndc-nodejs-lambda/pull/33)). This enables the use of very nested object graphs.
- Updated the NDC TypeScript SDK to v4.6.0 ([#33](https://github.com/hasura/ndc-nodejs-lambda/pull/33)).
  - This enables the /metrics endpoint to return the default prometheus metrics
  - `ConnectorError`s can be thrown and now use any HTTP status code

## [1.3.0] - 2024-04-17
- Fixed watch mode not reloading after files with compiler errors are changed [#27](https://github.com/hasura/ndc-nodejs-lambda/pull/27)
- Fixed functions that are imported then re-exported causing a crash [#28](https://github.com/hasura/ndc-nodejs-lambda/pull/28)
- Support for NDC Spec v0.1.2 via the NDC TypeScript SDK v4.4.0 ([#29](https://github.com/hasura/ndc-nodejs-lambda/pull/29)).
  - Built-in scalar types that support equality now define it in the NDC schema.
  - Built-in scalar types now have an explicit type representation defined in the NDC schema.
- Fixed functions that return null causing crashes ([#31](https://github.com/hasura/ndc-nodejs-lambda/pull/31))
- Added support for native connector packaging ([#30](https://github.com/hasura/ndc-nodejs-lambda/pull/30))
- [b3 (zipkin)](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-propagator-b3#b3-formats) OpenTelemetry trace propagation support via the NDC TypeScript SDK v4.5.0 ([#32](https://github.com/hasura/ndc-nodejs-lambda/pull/31))

## [1.2.0] - 2024-03-18
- Improved error messages when unsupported enum types or unions of literal types are found, and allow these types to be used in relaxed types mode ([#17](https://github.com/hasura/ndc-nodejs-lambda/pull/17))
- Improved naming of types that reside outside of the main `functions.ts` file. Type names will now only be prefixed with a disambiguator if there is a naming conflict detected (ie. where two different types use the same name). Anonymous types are now also named in a shorter way. ([#21](https://github.com/hasura/ndc-nodejs-lambda/pull/21))
- Updated NodeJS to v20 and TypeScript to v5.4.2 ([#23](https://github.com/hasura/ndc-nodejs-lambda/pull/23))
- Added a built-in Docker healthcheck, and ignored `node_modules` from the Docker build ([#22](https://github.com/hasura/ndc-nodejs-lambda/pull/22))

## [1.1.0] - 2024-02-26
- Updated to [NDC TypeScript SDK v4.2.0](https://github.com/hasura/ndc-sdk-typescript/releases/tag/v4.2.0) to include OpenTelemetry improvements. Traced spans should now appear in the Hasura Console
- Custom OpenTelemetry trace spans can now be emitted by creating an OpenTelemetry tracer and using it with `sdk.withActiveSpan` ([#16](https://github.com/hasura/ndc-nodejs-lambda/pull/16))

## [0.16.0] - 2024-02-23
- Updated to [NDC TypeScript SDK v1.4.0](https://github.com/hasura/ndc-sdk-typescript/releases/tag/v1.4.0) to include OpenTelemetry improvements. Traced spans should now appear in the Hasura Console
- Additional OpenTelemetry trace spans covering work done around function invocations

## [1.0.0] - 2024-02-22
### ndc-lambda-sdk
- Support for NDC Spec v0.1.0-rc.15 via the NDC TypeScript SDK v4.1.0 ([#8](https://github.com/hasura/ndc-nodejs-lambda/pull/8), [#10](https://github.com/hasura/ndc-nodejs-lambda/pull/11), [#13](https://github.com/hasura/ndc-nodejs-lambda/pull/13)). This is a breaking change and must be used with the latest Hasura engine.
  - Support for nested object/array selection
  - New function calling convention that relies on nested object queries
  - New mutation request/response format
  - [New names](https://github.com/hasura/ndc-sdk-typescript/releases/tag/v4.0.0) for configuration environment variables
  - The default port is now 8080 instead of 8100
  - OpenTelemetry support improved, with additional spans covering work done around function invocation

### Yeoman template
- Prompts the user to pick between a version of ndc-lambda-sdk that works for Hasura DDN Alpha or Hasura DDN Beta

## [0.15.0] - 2024-02-21
- OpenTelemetry support added via support for NDC TypeScript SDK v1.3.0 ([#12](https://github.com/hasura/ndc-nodejs-lambda/pull/12))

## [0.14.0] - 2024-02-16
- Support for "relaxed types" ([#10](https://github.com/hasura/ndc-nodejs-lambda/pull/10))

## [0.13.0] - 2024-02-09
- Add support for treating 'true | false' as a Boolean type ([#7](https://github.com/hasura/ndc-nodejs-lambda/pull/7))

## [0.12.0] - 2024-01-31
- Add support for JSDoc descriptions from object types ([#3](https://github.com/hasura/ndc-nodejs-lambda/pull/3))
- Fix type name conflicts when using generic interfaces ([#4](https://github.com/hasura/ndc-nodejs-lambda/pull/4))
- Improve error handling of errors thrown from functions ([#5](https://github.com/hasura/ndc-nodejs-lambda/pull/5))
  - The entire causal stack trace is now captured as an error detail for unhandled errors
  - `sdk.Forbidden`, `sdk.Conflict`, `sdk.UnprocessableContent` can be thrown to return error details to GraphQL API clients

## [0.11.0] - 2024-01-25
- Add support for parallel execution of readonly functions ([#2](https://github.com/hasura/ndc-nodejs-lambda/pull/2))

## [0.10.0] - 2024-01-23
- Add missing query.variables capability

## [0.9.0] - 2024-01-22
- Disallow use of Map types and types with index signatures
- Add support for re-exporting functions from other files

## [0.8.0] - 2024-01-18
### ndc-lambda-sdk
- Fix queries with variables returning incorrect result format
- If a scalar value validation fails, return the error as an UnprocessableContent error

### Yeoman template
- Add minimum node engine version to template package.json
- Use pretty printing of logs in watch mode in the template
- Add latest version check to yeoman generator

## [0.7.0] - 2024-01-17
- Rename `@pure` to `@readonly`
- Add JSONValue type for arbitrary JSON
- Block use of never, object, unknown, any and tuple types
- Block use of function types as args/return values
- Disallow use of union types in args and return types
- Remove custom scalar generation as an unknown type fallback

## [0.6.0] - 2024-01-15
- Prevent usage of null or undefined literals on their own
- Add support for literal types
- Fix queries not using new response reshaping code

## [0.5.0] - 2024-01-11
- Fix SIGTERM signal handling for clean docker container shutdowns
- Add BigInt support and rework scalar type handling
- Add support for Date types

## [0.4.0] - 2024-01-04
- Allow promise typed return values
- Fix tsconfig relative pathing
- Fix error when no user tsconfig exists

## [0.3.0] - 2023-12-22
- Initial release
