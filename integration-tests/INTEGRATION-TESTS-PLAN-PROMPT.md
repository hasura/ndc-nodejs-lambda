  # Integration Tests Plan for ndc-nodejs-lambda

  ## Overview
  Add integration tests that test the ndc-nodejs-lambda connector with a local DDN project. The tests exercise the full connector lifecycle: DDN project initialization, connector startup, NDC endpoint verification, DDN introspection, and
  supergraph build.

  ## Directory Structure
  ```
  integration-tests/
  ├── package.json              # Test package with local SDK reference
  ├── tsconfig.json
  ├── .mocharc.json             # Mocha config (120s timeout)
  ├── fixtures/
  │   └── functions.ts          # Test functions covering all type variations
  └── src/
    ├── helpers/
    │   ├── connector-server.ts  # Spawn/stop connector process, health polling
    │   ├── http-client.ts       # Typed NDC HTTP client (uses Node.js fetch)
    │   ├── ddn-project.ts       # DDN CLI wrappers (init, introspect, build)
    │   └── temp-dir.ts          # Temp directory create/cleanup
    └── tests/
      ├── root-hooks.ts        # Mocha root hooks: setup DDN project + start server
      ├── health.test.ts
      ├── capabilities.test.ts
      ├── schema.test.ts       # Validate NDC schema for all fixture functions
      ├── query.test.ts        # Test queries: scalars, objects, arrays, async, variables
      ├── mutation.test.ts     # Test mutations: procedures, state, async
      ├── error-handling.test.ts  # Forbidden/Conflict/Unprocessable/500 errors
      ├── ddn-introspect.test.ts  # DDN connector introspect against running server
      └── ddn-build.test.ts       # DDN supergraph build local
  ```

  ## Test Lifecycle (root-hooks.ts)

  **beforeAll** (runs once):
  1. Build the ndc-lambda-sdk (`npm run build` in `../ndc-lambda-sdk`)
  2. Create temp directory for DDN project
  3. `ddn supergraph init <tempdir>/test-project`
  4. `ddn connector init myjs --hub-connector hasura/nodejs --subgraph .../app/subgraph.yaml --configure-port 9876`
  5. Copy `fixtures/functions.ts` into connector directory
  6. Patch connector's `package.json` to use `file:` reference to local SDK
  7. `npm install` in connector directory
  8. Start connector via `node ndc-lambda-sdk/bin/index.js host -f functions.ts serve --configuration ./ --port 9876`
  9. Poll `/health` until 200 OK (30s timeout)

  **afterAll** (runs once):
  1. SIGTERM the connector process
  2. Remove temp directory

  ## Test Fixture (fixtures/functions.ts)

  Covers:
  - **Scalar types**: string, number, boolean, bigint (all `@readonly`)
  - **Optional/nullable args**: `string | null`, `value?: string`
  - **Object types**: `Coordinates`, `Place` (nested objects as args and return)
  - **Array types**: `string[]`, `number[]` args and returns
  - **Nested return types**: `PersonWithAddress` with nested `address` object
  - **Async functions**: `Promise<string>`, `Promise<object>`
  - **Procedures** (no `@readonly`): `incrementCounter`, `resetCounter`, `createUser`, `asyncCreateItem`
  - **SDK errors**: `sdk.Forbidden`, `sdk.Conflict`, `sdk.UnprocessableContent`, plain `Error`

  ## Files to Create

  1. `integration-tests/package.json` - Dependencies: local SDK via `file:../ndc-lambda-sdk`, mocha, chai, ts-node, typescript
  2. `integration-tests/tsconfig.json` - Extends `@tsconfig/node20`
  3. `integration-tests/.mocharc.json` - 120s timeout, loads `root-hooks.ts` via `--require`
  4. `integration-tests/fixtures/functions.ts` - All test functions
  5. `integration-tests/src/helpers/temp-dir.ts` - `createTempDir()`, `removeTempDir()`
  6. `integration-tests/src/helpers/http-client.ts` - `createNdcClient()` returning typed client
  7. `integration-tests/src/helpers/connector-server.ts` - `startConnectorServer()`, health polling, `stop()`
  8. `integration-tests/src/helpers/ddn-project.ts` - `initSupergraph()`, `initConnector()`, `introspectConnector()`, `supergraphBuildLocal()`
  9. `integration-tests/src/tests/root-hooks.ts` - Mocha root hooks exporting shared `server`, `client`, `ddnProject`
  10. `integration-tests/src/tests/health.test.ts` - GET /health → 200
  11. `integration-tests/src/tests/capabilities.test.ts` - GET /capabilities → query/mutation capabilities
  12. `integration-tests/src/tests/schema.test.ts` - Validates functions/procedures/scalars/objectTypes in schema
  13. `integration-tests/src/tests/query.test.ts` - ~15 test cases (hello, add, isTrue, bigint, nullable, optional, arrays, objects, nested, async, variables)
  14. `integration-tests/src/tests/mutation.test.ts` - Procedures: increment, create, async, state persistence
  15. `integration-tests/src/tests/error-handling.test.ts` - Error status codes (403, 409, 422, 500, 400)
  16. `integration-tests/src/tests/ddn-introspect.test.ts` - `ddn connector introspect` succeeds
  17. `integration-tests/src/tests/ddn-build.test.ts` - `ddn supergraph build local` succeeds, build artifacts exist

  ## Key Design Decisions

  - **Single server for all tests**: Server startup involves TS compilation (~5-15s). Shared instance via root hooks.
  - **Port 9876**: Avoids conflicts with default 8080 and common dev ports.
  - **Local SDK via `file:`**: Tests always run against repo code, not published version.
  - **Node.js built-in `fetch`**: No extra HTTP client dependency (Node 22 has it).
  - **`child_process.spawn`**: For connector process management (no cross-spawn needed in test code, Linux-only).
  - **Temp directory in OS tmpdir**: Prevents DDN artifacts from polluting repo.

  ## Verification

  After implementation:
  ```bash
  cd ndc-lambda-sdk && npm ci && npm run build
  cd ../integration-tests && npm install && npm test
  ```

  Expected: All tests pass (health, capabilities, schema, query, mutation, errors, DDN introspect, DDN build).
