import * as path from 'path';
import { ApiComponents } from './api-generator';
import { ParsedApiRoutes } from './parsedApiRoutes';
import { Eta } from 'eta';
import { getTemplatesDirectory } from "./index";

const CircularJSON = require('circular-json');

let templateDir: string; // cannot be a constant because calling `getTemplateDirectory` results in a compilation error
const templateFile = "functions.ejs";

export function generateFunctionsTypescriptFile(apiComponents: ApiComponents): string {
  templateDir = path.resolve(getTemplatesDirectory(), './functions');

  const parseApiRoutes = new ParsedApiRoutes(new Set<string>(apiComponents.getTypeNames()));

  for (let route of apiComponents.routes) {
    parseApiRoutes.parse(route);
  }

  const eta = new Eta({ views: templateDir});
  const fileStr = eta.render(templateFile, { apiRoutes: parseApiRoutes.getApiRoutes(), importList: parseApiRoutes.getImportList(), baseUrl: "localhost:9090" });
  return fileStr;
}
