import { generateOpenApiTypescriptFile } from './api-generator';
import * as path from 'path';
import { generateFunctionsTypescriptFile } from './function-generator';

function isValidUrl(uri: string): boolean {
  let url;
  try {
    url = new URL(uri);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

function isValidFileUrl(uri: string): boolean {
  let url;
  try {
    url = new URL(uri);
  } catch (_) {
    return false;
  }
  return url.protocol === "file:";
}

function getFilePath(uri: string): string {
  if (isValidFileUrl(uri)) {
    const path = new URL(uri);
    return path.pathname;
  }
  return path.resolve(uri);
}

export async function generateCode(openApiUri: string, outputDir: string): Promise<string> {
  console.log('generateCode() called');
  const apiComponents = await generateOpenApiTypescriptFile(
    "Api.ts",
    isValidUrl(openApiUri) ? openApiUri : undefined,
    isValidUrl(openApiUri) ? undefined : getFilePath(openApiUri),
    outputDir,
    undefined,
  );

  const functionFileStr = generateFunctionsTypescriptFile(apiComponents);
  return functionFileStr;
}
