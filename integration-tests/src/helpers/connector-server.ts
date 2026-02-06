import { spawn, ChildProcess } from "child_process";
import * as path from "path";

export interface ConnectorServer {
  process: ChildProcess;
  port: number;
  stop(): void;
}

export function startConnectorServer(opts: {
  functionsFile: string;
  configurationDir: string;
  port: number;
}): ConnectorServer {
  const sdkBinPath = path.resolve(__dirname, "../../../ndc-lambda-sdk/bin/index.js");

  const proc = spawn(
    "node",
    [
      sdkBinPath,
      "host",
      "-f", opts.functionsFile,
      "serve",
      "--configuration", opts.configurationDir,
      "--port", String(opts.port),
    ],
    {
      cwd: opts.configurationDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "test" },
    }
  );

  proc.stdout?.on("data", (data: Buffer) => {
    if (process.env.DEBUG) {
      process.stdout.write(`[connector stdout] ${data}`);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    if (process.env.DEBUG) {
      process.stderr.write(`[connector stderr] ${data}`);
    }
  });

  return {
    process: proc,
    port: opts.port,
    stop() {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    },
  };
}

export async function waitForHealth(
  baseUrl: string,
  timeoutMs: number = 30000
): Promise<void> {
  const start = Date.now();
  const pollIntervalMs = 500;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Connector did not become healthy within ${timeoutMs}ms`);
}
