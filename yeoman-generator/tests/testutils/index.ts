import * as fs from 'fs';

export function generateRandomDir(dirName: string): string {
  const randomSuffix = (Math.random() + 1).toString(36).substring(7); // https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
  const outDir = `${dirName}_${randomSuffix}`;
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  return outDir;
}
