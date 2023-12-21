# ndc-nodejs-lambda

The NodeJS Lambda connector allows you to expose TypeScript functions as NDC functions/procedures for use in your Hasura DDN subgraphs.

# How to Use
First create a `functions.ts` that contains your functions, for example:
```typescript
/**
 * @pure Exposes the function as an NDC function (the function should only query data without making modifications)
 */
export function hello(name?: string) {
  return `hello ${name ?? "world"}`;
}
```
Then add a `configuration.json` file that simply contains an empty configuration object:
```json
{}
```

Now add a `package.json` file that depends on the `ndc-lambda-sdk` like so:
```json
{
  "private": true,
  "scripts": {
    "start": "ndc-lambda-sdk host -f functions.ts serve --configuration configuration.json",
    "watch": "ndc-lambda-sdk host -f functions.ts --watch serve --configuration configuration.json"
  },
  "dependencies": {
    "@hasura/ndc-lambda-sdk": "0.2.0"
  }
}
```
Now run `npm install` to install all the packages.

Notice the `start` and `watch` scripts in the `package.config`. These use the SDK to host your `functions.ts` file. You can start your connector with `npm start`, or if you'd like it to automatically restart as you change your code, use `npm run watch`.
