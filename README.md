# Node.js Lambda Connector

The Node.js Lambda connector allows you to expose TypeScript functions as NDC functions/procedures for use in your Hasura DDN subgraphs.

> [!IMPORTANT]
> Hasura DDN Alpha users should use 0.x versions of the `ndc-lambda-sdk`. v1.x versions of the `ndc-lambda-sdk` support the forthcoming Hasura DDN Beta.

## How to Use
First, ensure you have Node.js v18+ installed. Then, create a directory into which you will create your functions using the `hasura-ndc-nodejs-lambda` Yeoman template.

```bash
mkdir my-functions
cd my-functions
npm install -g generator-hasura-ndc-nodejs-lambda
npx yo hasura-ndc-nodejs-lambda
```

This creates a `functions.ts` file in which you will write your functions, and a `package.json` with the `ndc-lambda-sdk` installed into it.

The `package.config` has been created with `start` and `watch` scripts. These use the SDK to host your `functions.ts` file. You can start your connector with `npm start`, or if you'd like it to automatically restart as you change your code, use `npm run watch`.

### Functions
Any functions exported from `functions.ts` are made available as NDC functions/procedures to use in your Hasura metadata and expose as GraphQL fields in queries or mutation.

If you write a function that performs a read-only operation, you should mark it with the `@readonly` JSDoc tag, and it will be exposed as an NDC function, which will ultimately show up as a GraphQL query field in Hasura.

```typescript
/** @readonly */
export function add(x: number, y: number): number {
  return x + y;
}
```

Functions without the `@readonly` JSDoc tag are exposed as NDC procedures, which will ultimately show up as a GraphQL mutation field in Hasura.

Arguments to the function end up being field arguments in GraphQL and the return value is what the field will return when queried. Every function must return a value; `void`, `null` or `undefined` is not supported.

```typescript
/** @readonly */
export function hello(name: string, year: number): string {
  return `Hello ${name}, welcome to ${year}`
}
```

Async functions are supported:

```typescript
type HttpStatusResponse = {
  code: number
  description: string
}

export async function test(): Promise<string> {
  const result = await fetch("http://httpstat.us/200")
  const responseBody = await result.json() as HttpStatusResponse;
  return responseBody.description;
}
```

If you'd like to split your functions across multiple files, do so, then simply re-export them from `functions.ts` like so:

```typescript
export * from "./another-file-1"
export * from "./another-file-2"
```

The `ndc-lambda-sdk` uses the TypeScript types specified for your function arguments and return types to automatically derive the NDC schema (function/procedure schema, scalar types and object types) for your functions. This makes the available in your Hasura DDN metadata, where they can be bound to [Commands](https://hasura.io/docs/3.0/supergraph-modeling/commands/) and thereby exposed in your GraphQL supergraph.

### Supported types
The basic scalar types supported are:

* `string` (NDC scalar type: `String`)
* `number` (NDC scalar type: `Float`)
* `boolean` (NDC scalar type: `Boolean`)
* `bigint` (NDC scalar type: `BigInt`, represented as a string in JSON)
* `Date` (NDC scalar type: `DateTime`, represented as an [ISO formatted](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) string in JSON)

You can also import `JSONValue` from the SDK and use it to accept and return arbitrary JSON. Note that the value must be serializable to JSON.

```typescript
import * as sdk from "@hasura/ndc-lambda-sdk"

export function myFunc(json: sdk.JSONValue): sdk.JSONValue {
  const propValue =
    json.value instanceof Object && "prop" in json.value && typeof json.value.prop === "string"
      ? json.value.prop
      : "default value";
  return new sdk.JSONValue({prop: propValue});
}
```

`null`, `undefined` and optional arguments/properties are supported:

```typescript
export function myFunc(name: string | null, age?: number): string {
  const greeting = name != null
    ? `hello ${name}`
    : "hello stranger";
  const ageStatement = age !== undefined
    ? `you are ${age}`
    : "I don't know your age";

  return `${greeting}, ${ageStatement}`;
}
```

However, any `undefined`s in the return type will be converted to nulls, as GraphQL does not have the concept of `undefined`.

Object types and interfaces are supported. The types of the properties defined on these must be supported types.

```typescript
type FullName = {
  title: string
  firstName: string
  surname: string
}

interface Greeting {
  polite: string
  casual: string
}

export function greet(name: FullName): Greeting {
  return {
    polite: `Hello ${name.title} ${name.surname}`,
    casual: `G'day ${name.firstName}`
  }
}
```

Arrays are also supported, but can only contain a single type (tuple types are not supported):

```typescript
export function sum(nums: number[]): number {
  return nums.reduce((prev, curr) => prev + curr, 0);
}
```

Anonymous types are supported, but will be automatically named after the first place they are used. It is recommended that you **avoid using anonymous types**. Instead, prefer to name all your types to ensure the type name does not change unexpectedly as you rename usage sites and re-order usages of the anonymous type.

```typescript
export function greet(
  name: { firstName: string, surname: string } // This type will be automatically named greet_name
): string {
  return `Hello ${name.firstName} ${name.surname}`;
}
```

### Unsupported types

These types are unsupported as function parameter types or return types for functions that you export for invocation from Hasura. You can use whatever types you like _inside_ your function or in related code, however.

* [Union types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types) (eg. `string | number`) - unless you are unioning `null` and/or `undefined` to a single other type
* [Tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types) (eg. `[string, number]`)
* Promises - unless it is the direct return type of a function
* [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
* [JavaScript Map type](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
* Types with [index signatures](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures)
* [Function types](https://www.typescriptlang.org/docs/handbook/2/functions.html#function-type-expressions) - function types can't be accepted as arguments or returned as values
* [`void`](https://www.typescriptlang.org/docs/handbook/2/functions.html#void), [`object`](https://www.typescriptlang.org/docs/handbook/2/functions.html#object), [`unknown`](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown), [`never`](https://www.typescriptlang.org/docs/handbook/2/functions.html#never), [`any`](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any) types - to accept and return arbitrary JSON, use `sdk.JSONValue` instead
* `null` and `undefined` - unless used in a union with a single other type
* [Enum types](https://www.typescriptlang.org/docs/handbook/enums.html)

### Relaxed Types
"Relaxed types" are types that are otherwise unsupported, but instead of being rejected are instead converted into opaque custom scalar types. These scalar types are entirely unvalidated when used as input (ie. the caller of the function can send arbitrary JSON values), making it incumbent on the function itself to ensure the incoming value for that relaxed type actually matches its type. Because relaxed types are represented as custom scalar types, in GraphQL you will be unable to select into the type, if it is an object, and will only be able to select the whole thing.

Relaxed types are designed to be an escape hatch to help people get up and running using existing code quickly, where their existing code uses types that are unsupported. They are **not intended to be used long term**. You should prefer to modify your code to use only supported types. To opt into using relaxed types, one must apply the `@allowrelaxedtypes` JSDoc tag to the function that will be using the unsupported types.

The following unsupported types are allowed when using relaxed types, and will be converted into opaque unvalidated scalar types:

* Union types
* Tuple types
* Types with index signatures
* The `any` and `unknown` types
* Enum types

Here's an example of a function that uses some relaxed types:

```typescript
/**
 * @allowrelaxedtypes
 * @readonly
 */
export function findEmptyRecords(record: Record<string, string>): { emptyKeys: string[] } | string {
  const emptyKeys: string[] = [];
  const entries = Object.entries(record);

  if (entries.length === 0)
    return "Error: record was empty";

  for (const [key, value] of entries) {
    if (value === "")
      emptyKeys.push(key);
  }

  return { emptyKeys };
}
```

### Error handling
By default, unhandled errors thrown from functions are caught by the Lambda SDK host, and an `InternalServerError` is returned to Hasura. The details of the uncaught error (the message and stack trace) is captured and will be logged in the OpenTelemetry trace associated with the GraphQL request. However, the GraphQL API caller will receive a generic "internal error" response to their query. This is to ensure internal error details are not leaked to GraphQL API clients.

If you want to return specific error details to the GraphQL API client, you can deliberately throw one of the below error classes (these error types correspond with the error status codes in the [NDC Specification](https://hasura.github.io/ndc-spec/specification/error-handling.html)):

| Error Class              | Used When |
|--------------------------|-----------|
| sdk.Forbidden            | A permission check failed - for example, a mutation might fail because a check constraint was not met. |
| sdk.Conflict             | A conflicting state would be created for the data source - for example, a mutation might fail because a foreign key constraint was not met. |
| sdk.UnprocessableContent | There was something semantically incorrect in the request. For example, an invalid value for a function argument was received. |

```typescript
import * as sdk from "@hasura/ndc-lambda-sdk"

/** @readonly */
export function divide(x: number, y: number): number {
  if (y === 0) {
    throw new sdk.UnprocessableContent("Cannot divide by zero", { myErrorMetadata: "stuff", x, y })
  }
  return x / y;
}
```

The GraphQL API will return the error from the API looking similar to this:

```json
{
  "data": null,
  "errors": [
    {
      "message": "ndc: Cannot divide by zero",
      "path": ["divide"],
      "extensions": {
        "details": {
          "myErrorMetadata": "stuff",
          "x": 10,
          "y": 0
        }
      }
    }
  ]
}
```

If you must include stack traces in the GraphQL API response, you can collect and add them to the error details yourself using a helper function (`sdk.getErrorDetails`). However, it is not recommended to expose stack traces to API end users. Instead, API administrators can look in the GraphQL API tracing to find the stack traces logged.

```typescript
import * as sdk from "@hasura/ndc-lambda-sdk"

/** @readonly */
export function getStrings(): Promise<string[]> {
  try {
    return await queryForStrings();
  } catch (e) {
    const details = e instanceof Error
      ? sdk.getErrorDetails(e) // Returns { message: string, stack: string }
      : {};
    throw new sdk.UnprocessableContent("Something went wrong :/", details)
  }
}
```

### Parallel execution
If functions are involved remote relationships in your Hasura metadata, then they may be queried in a [batch-based fashion](https://hasura.github.io/ndc-spec/specification/queries/variables.html). In this situation, any async functions that are marked with the `@readonly` JSDoc tag may be executed in parallel. The default degree of parallelism per query request to the connector is 10, but you may customise this by using the `@paralleldegree` JSDoc tag on your function.

``` typescript
/**
 * This function will only run up to 5 http requests in parallel per query
 *
 * @readonly
 * @paralleldegree 5
 */
export async function test(statusCode: number): Promise<string> {
  const result = await fetch("http://httpstat.us/${statusCode}")
  const responseBody = await result.json() as any;
  return responseBody.description;
}
```

Non-readonly functions are not invoked in parallel within the same mutation request to the connector, so it is invalid to use the @paralleldegree JSDoc tag on those functions.

### Documentation
*Note: this feature is still in development.*

JSDoc comments on your functions and types are used to provide descriptions for types exposed in your GraphQL schema. For example:

```typescript
/** Different types of greetings */
interface Greeting {
  /** A greeting if you want to be polite */
  polite: string
  /** A casual-toned greeting */
  casual: string
}

/**
 * Creates a greeting string using the specified name
 *
 * @param title The person's title, for example, Mr or Mrs
 * @param firstName The person's first name
 * @param lastName The person's last name (surname)
 * @readonly
 */
export function greet(title: string, firstName: string, lastName: string): Greeting {
  return {
    polite: `Hello ${title} ${lastName}`,
    casual: `G'day ${firstName}`
  }
}
```

Descriptions are collected for:
* Functions
* Function parameters
* Types
* Type properties

### Tracing
Your functions are automatically instrumented with OpenTelemetry traces that Hasura will capture.

By default, the following spans are emitted:
* `handleQuery`/`handleMutation` - wraps the request from the Hasura DDN to the connector
* `prepare arguments` - wraps the process of preparing arguments to pass to your function
* `function invocation` - wraps a (potentially) parallel function invocation during a query
* `Function: <function name>` - wraps the invocation of your function
* `reshape result` - wraps the projection of the function result to match the requirements of the GraphQL selection set

If you want to add additional spans around your own code, you can do so by using the OpenTelemetry SDK and `withActiveSpan` from `ndc-lambda-sdk`:

```typescript
import opentelemetry from '@opentelemetry/api';
import * as sdk from "@hasura/ndc-lambda-sdk"

const tracer = opentelemetry.trace.getTracer("my functions"); // Name your functions service here

export async function doSomething(): Promise<string> {
  const spanAttributes = { myAttribute: "value" };
  return await sdk.withActiveSpan(tracer, "my span name", async () => {
    return await doSomethingExpensive();
  }, spanAttributes);
}
```

The span will be wrapped around the function you pass to `sdk.withActiveSpan`. The function can optionally be an async function that returns a Promise, and if so, the span will be ended when the Promise resolves.

## Deploying with `hasura3 connector create`

You will need:

* [Hasura v3 CLI](https://hasura.io/docs/3.0/cli/installation/) (with a logged-in session)
* [Hasura v3 CLI Connector Plugin](https://hasura.io/docs/latest/hasura-cli/connector-plugin/)
* (Optionally) A value to use with `SERVICE_TOKEN_SECRET`
* a TypeScript sources directory. E.g. `--volume ./my_functions_directory:/functions`

First, ensure you have deleted your `node_modules` directory from inside your sources directory, since that is unnecessary to deploy.

Then, create the connector:

```bash
hasura3 connector create my-cool-connector:v1 \
  --github-repo-url https://github.com/hasura/ndc-nodejs-lambda/tree/main \
  --config-file <(echo '{}') \
  --volume ./my_functions_directory:/functions \
  --env SERVICE_TOKEN_SECRET=MY-SERVICE-TOKEN # (optional)
```

*Note: Even though you can use the "main" branch to deploy the latest connector features, see the [Hasura Connector Hub](https://hasura.io/connectors/nodejs-lambda) for verified release tags*

Monitor the deployment status by name - this will indicate in-progress, complete, or failed status:

> hasura3 connector status my-cool-connector:v1

List all your connectors with their deployed URLs:

> hasura3 connector list

View logs from your running connector:

> hasura3 connector logs my-cool-connector:v1
