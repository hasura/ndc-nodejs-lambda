import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function createTempDir(prefix: string = "ndc-lambda-integration-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}
