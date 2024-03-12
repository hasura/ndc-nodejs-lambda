import { generateOpenApiTypescriptFile } from './api-generator';
import * as path from 'path';
import * as fs from 'fs';
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

/**
 * this function is added because the variable `__dirname` points to two different
 * locations depending on how the code is being run.
 * If the code is run via tests, it points to the directory in typescript code layout
 * otherwise it points to the genenrated javascript directory
 *
 * @returns the correct parent directory containing templates
 */
export const getTemplatesDirectory = (): string => {
  if (fs.existsSync(path.resolve(__dirname, '../../templates'))) {
    return path.resolve(__dirname, '../../templates');
  } else {
    return path.resolve(__dirname, '../../../templates');
  }
}

export async function generateCode(openApiUri: string, outputDir: string): Promise<string> {
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
