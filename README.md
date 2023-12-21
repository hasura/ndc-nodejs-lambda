# ndc-nodejs-lambda

The NodeJS Lambda connector allows you to expose TypeScript functions as NDC functions/procedures for use in your Hasura DDN subgraphs.

# How to Use
First, ensure you have NodeJS v18+ installed. Then, create a directory into which you will create your functions using the `hasura-ndc-nodejs-lambda` Yeoman template.

```bash
mkdir my-functions
cd my-functions
npx yo hasura-ndc-nodejs-lambda
```

This creates a `functions.ts` file in which you will write your functions, and a `package.json` with the `ndc-lambda-sdk` installed into it.

The `package.config` has been created with `start` and `watch` scripts. These use the SDK to host your `functions.ts` file. You can start your connector with `npm start`, or if you'd like it to automatically restart as you change your code, use `npm run watch`.
