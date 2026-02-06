import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createTempDir, removeTempDir } from "../helpers/temp-dir";
import { createNdcClient, NdcClient } from "../helpers/http-client";
import {
  startConnectorServer,
  waitForHealth,
  ConnectorServer,
} from "../helpers/connector-server";
import {
  initSupergraph,
  initConnector,
  updateDataConnectorLinkSchema,
} from "../helpers/ddn-project";

const CONNECTOR_PORT = 9876;
const CONNECTOR_NAME = "myjs";

export let server: ConnectorServer;
export let client: NdcClient;
export let ddnProjectDir: string;
export let connectorDir: string;

let tempDir: string;

export const mochaHooks = {
  async beforeAll(this: Mocha.Context) {
    this.timeout(180000);

    // 1. Build the ndc-lambda-sdk
    const sdkDir = path.resolve(__dirname, "../../../ndc-lambda-sdk");
    console.log("    Building ndc-lambda-sdk...");
    execSync("npm ci && npm run build", { cwd: sdkDir, stdio: "pipe" });

    // 2. Create temp directory and init DDN project
    tempDir = createTempDir();
    ddnProjectDir = path.join(tempDir, "test-project");
    console.log(`    Initializing DDN project in ${ddnProjectDir}...`);
    initSupergraph(ddnProjectDir);

    // 3. Init connector
    console.log("    Initializing connector...");
    const subgraphPath = path.join(ddnProjectDir, "app", "subgraph.yaml");
    process.chdir(ddnProjectDir);
    initConnector({
      connectorName: CONNECTOR_NAME,
      hubConnector: "hasura/nodejs",
      subgraphPath: subgraphPath,
      configurePort: CONNECTOR_PORT,
    });

    // 4. Set up connector directory
    connectorDir = path.join(ddnProjectDir, "app", "connector", CONNECTOR_NAME);

    // 5. Copy test fixtures functions.ts into connector directory
    const fixturesSource = path.resolve(__dirname, "../../fixtures/functions.ts");
    const functionsDest = path.join(connectorDir, "functions.ts");
    fs.copyFileSync(fixturesSource, functionsDest);

    // 6. Patch connector's package.json to use local SDK
    // Also need to add @tsconfig/node20 explicitly because it's referenced by the connector's
    // tsconfig.json but isn't hoisted when using file: references to the local SDK
    const pkgPath = path.join(connectorDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const absoluteSdkPath = path.resolve(__dirname, "../../../ndc-lambda-sdk");
    pkg.dependencies["@hasura/ndc-lambda-sdk"] = `file:${absoluteSdkPath}`;
    pkg.dependencies["@tsconfig/node20"] = "^20.1.4";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    // 7. npm install in connector directory
    console.log("    Installing connector dependencies...");
    execSync("npm install", { cwd: connectorDir, stdio: "pipe" });

    // 8. Start connector server
    console.log("    Starting connector server...");
    server = startConnectorServer({
      functionsFile: "functions.ts",
      configurationDir: connectorDir,
      port: CONNECTOR_PORT,
    });

    // 9. Wait for health
    client = createNdcClient(CONNECTOR_PORT);
    console.log("    Waiting for connector to be healthy...");
    await waitForHealth(client.baseUrl, 60000);
    console.log("    Connector is healthy.");

    // 10. Update DataConnectorLink with schema from running connector
    // This is needed for DDN supergraph build to work without Docker
    console.log("    Updating DataConnectorLink schema...");
    await updateDataConnectorLinkSchema({
      connectorName: CONNECTOR_NAME,
      ddnProjectDir,
      connectorBaseUrl: client.baseUrl,
    });
    console.log("    DataConnectorLink schema updated.");
  },

  async afterAll(this: Mocha.Context) {
    this.timeout(30000);

    if (server) {
      console.log("    Stopping connector server...");
      server.stop();
      // Wait briefly for process to terminate
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (tempDir) {
      console.log("    Cleaning up temp directory...");
      removeTempDir(tempDir);
    }
  },
};
