# ndc-nodejs-lambda

The NodeJS Lambda connector allows you to expose TypeScript functions as NDC functions/procedures for use in your Hasura DDN subgraphs.

## How to Use
First, ensure you have NodeJS v18+ installed. Then, create a directory into which you will create your functions using the `hasura-ndc-nodejs-lambda` Yeoman template.

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

Arguments to the function end up being field arguments in GraphQL and the return value is what the field will return when queried. Every function must return a value; `void`, `null` or `undefined` is not supported.

```typescript
/** @pure */
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

### Unsupported types

These types are unsupported as function parameter types or return types for functions that you export for invocation from Hasura. You can use whatever types you like _inside_ your function or in related code, however.

* [Union types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types) (eg. `string | number`) - unless you are unioning `null` and/or `undefined` to a single other type
* [Tuple types](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types) (eg. `[string, number]`)
* Promises - unless it is the direct return type of a function
* [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
* [JavaScript Map type](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
* Function types - function types can't be accepted as arguments or returned as values
* [`void`](https://www.typescriptlang.org/docs/handbook/2/functions.html#void), [`object`](https://www.typescriptlang.org/docs/handbook/2/functions.html#object), [`unknown`](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown), [`never`](https://www.typescriptlang.org/docs/handbook/2/functions.html#never), [`any`](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any) types - to accept and return arbitrary JSON, use `sdk.JSONValue` instead
* `null` and `undefined` - unless used in a union with a single other type


### Impure/pure functions
If you write a function that performs a read-only operation, or is otherwise a pure function (no side-effects), you can mark it with the `@pure` JSDoc tag, and it will be exposed as an NDC function, which will ultimately show up as a GraphQL query field in Hasura.

```typescript
/** @pure */
export function add(x: number, y: number): number {
  return x + y;
}
```

Functions without the `@pure` JSDoc tag are exposed as NDC procedures, which will ultimately show up as a GraphQL mutation field in Hasura.

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
