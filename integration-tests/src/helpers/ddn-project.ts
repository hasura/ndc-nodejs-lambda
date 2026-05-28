import { execFileSync, ExecFileSyncOptionsWithStringEncoding } from "child_process";
import * as fs from "fs";
import * as path from "path";

const execOpts: ExecFileSyncOptionsWithStringEncoding = {
  encoding: "utf-8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 120000,
};

export function initSupergraph(targetDir: string): string {
  execFileSync("ddn", ["supergraph", "init", targetDir], execOpts);
  return targetDir;
}

export function initConnector(opts: {
  connectorName: string;
  hubConnector: string;
  subgraphPath: string;
  configurePort: number;
}): string {
  const output = execFileSync(
    "ddn",
    [
      "connector", "init", opts.connectorName,
      "--hub-connector", opts.hubConnector,
      "--subgraph", opts.subgraphPath,
      "--configure-port", String(opts.configurePort),
    ],
    execOpts
  );
  return output;
}

export function introspectConnector(opts: {
  connectorName: string;
  subgraphPath: string;
}): string {
  const output = execFileSync(
    "ddn",
    [
      "connector", "introspect", opts.connectorName,
      "--subgraph", opts.subgraphPath,
    ],
    execOpts
  );
  return output;
}

export function supergraphBuildLocal(opts: {
  supergraphPath: string;
}): string {
  const output = execFileSync(
    "ddn",
    [
      "supergraph", "build", "local",
      "--supergraph", opts.supergraphPath,
    ],
    execOpts
  );
  return output;
}

/**
 * Manually update the DataConnectorLink HML file with schema from a running connector.
 * This is an alternative to `ddn connector introspect` that doesn't require Docker.
 */
export async function updateDataConnectorLinkSchema(opts: {
  connectorName: string;
  ddnProjectDir: string;
  connectorBaseUrl: string;
}): Promise<void> {
  // Fetch schema and capabilities from the running connector
  const [schemaResponse, capabilitiesResponse] = await Promise.all([
    fetch(`${opts.connectorBaseUrl}/schema`),
    fetch(`${opts.connectorBaseUrl}/capabilities`),
  ]);

  if (!schemaResponse.ok) {
    throw new Error(`Failed to fetch schema: ${schemaResponse.status}`);
  }
  if (!capabilitiesResponse.ok) {
    throw new Error(`Failed to fetch capabilities: ${capabilitiesResponse.status}`);
  }

  const schema = await schemaResponse.json();
  const capabilities = await capabilitiesResponse.json();

  // Find and update the DataConnectorLink HML file
  const hmlPath = path.join(opts.ddnProjectDir, "app", "metadata", `${opts.connectorName}.hml`);
  const hmlContent = fs.readFileSync(hmlPath, "utf-8");

  // Parse the HML (it's YAML-like but we'll do simple string replacement)
  // The schema section looks like:
  //   schema:
  //     version: ""
  //     schema: {}
  //     capabilities: {}

  // We need to replace it with actual values
  const updatedHml = hmlContent
    .replace(/version: ""/g, 'version: "v0.2"')
    .replace(/schema: \{\}/g, `schema: ${JSON.stringify(schema)}`)
    .replace(/capabilities: \{\}/g, `capabilities: ${JSON.stringify(capabilities)}`);

  fs.writeFileSync(hmlPath, updatedHml);
}
