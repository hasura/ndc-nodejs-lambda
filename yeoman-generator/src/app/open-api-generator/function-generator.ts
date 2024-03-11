import * as path from 'path';
import { ApiComponents } from './api-generator';
import { ParsedApiRoutes } from './parsedApiRoutes';
import { Eta } from 'eta';

const CircularJSON = require('circular-json');

const templateDir = path.resolve(__dirname, '../../templates/functions')
const templateFile = "functions.ejs";

export function generateFunctionsTypescriptFile(apiComponents: ApiComponents): string {
  // const functionsFileFilePath = path.resolve(outputDir, "functions.ts");

  const parseApiRoutes = new ParsedApiRoutes(new Set<string>(apiComponents.getTypeNames()));

  for (let route of apiComponents.routes) {
    parseApiRoutes.parse(route);
  }

  const eta = new Eta({ views: templateDir});
  const fileStr = eta.render(templateFile, { apiRoutes: parseApiRoutes.getApiRoutes(), importList: parseApiRoutes.getImportList(), baseUrl: "localhost:9090" });
  return fileStr;
}
