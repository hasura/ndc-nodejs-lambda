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
