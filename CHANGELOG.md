# NodeJS Lambda Connector Changelog
This changelog documents the changes between release versions.

## main
Changes to be included in the next upcoming release

- OpenTelemetry support added via support for NDC TypeScript SDK v1.3.0

## v0.14.0
- Support for "relaxed types" ([#10](https://github.com/hasura/ndc-nodejs-lambda/pull/10))

## v0.13.0
- Add support for treating 'true | false' as a Boolean type ([#7](https://github.com/hasura/ndc-nodejs-lambda/pull/7))

## v0.12.0
- Add support for JSDoc descriptions from object types ([#3](https://github.com/hasura/ndc-nodejs-lambda/pull/3))
- Fix type name conflicts when using generic interfaces ([#4](https://github.com/hasura/ndc-nodejs-lambda/pull/4))
- Improve error handling of errors thrown from functions ([#5](https://github.com/hasura/ndc-nodejs-lambda/pull/5))
  - The entire causal stack trace is now captured as an error detail for unhandled errors
  - `sdk.Forbidden`, `sdk.Conflict`, `sdk.UnprocessableContent` can be thrown to return error details to GraphQL API clients

## v0.11.0
- Add support for parallel execution of readonly functions ([#2](https://github.com/hasura/ndc-nodejs-lambda/pull/2))

## v0.10.0
- Add missing query.variables capability

## v0.9.0
- Disallow use of Map types and types with index signatures
- Add support for re-exporting functions from other files

## v0.8.0
### ndc-lambda-sdk
- Fix queries with variables returning incorrect result format
- If a scalar value validation fails, return the error as an UnprocessableContent error

### Yeoman template
- Add minimum node engine version to template package.json
- Use pretty printing of logs in watch mode in the template
- Add latest version check to yeoman generator

## v0.7.0
- Rename `@pure` to `@readonly`
- Add JSONValue type for arbitrary JSON
- Block use of never, object, unknown, any and tuple types
- Block use of function types as args/return values
- Disallow use of union types in args and return types
- Remove custom scalar generation as an unknown type fallback

## v0.6.0
- Prevent usage of null or undefined literals on their own
- Add support for literal types
- Fix queries not using new response reshaping code

## v0.5.0
- Fix SIGTERM signal handling for clean docker container shutdowns
- Add BigInt support and rework scalar type handling
- Add support for Date types

## v0.4.0
- Allow promise typed return values
- Fix tsconfig relative pathing
- Fix error when no user tsconfig exists

## v0.3.0
- Initial release
