# NodeJS Lambda Connector Changelog
This changelog documents the changes between release versions.

> [!IMPORTANT]
> Hasura DDN Alpha users should use 0.x versions of the `ndc-lambda-sdk`. v1.x versions of the `ndc-lambda-sdk` support the forthcoming Hasura DDN Beta.

## [Unreleased]
Changes to be included in the next upcoming release

- Improved error messages when unsupported enum types or unions of literal types are found, and allow these types to be used in relaxed types mode ([#17](https://github.com/hasura/ndc-nodejs-lambda/pull/17))
- Improved naming of types that reside outside of the main `functions.ts` file. Type names will now only be prefixed with a disambiguator if there is a naming conflict detected (ie. where two different types use the same name). Anonymous types are now also named in a shorter way. ([#21](https://github.com/hasura/ndc-nodejs-lambda/pull/21))
- Updated NodeJS to v20 and TypeScript to v5.4.2 ([#23](https://github.com/hasura/ndc-nodejs-lambda/pull/23))

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
