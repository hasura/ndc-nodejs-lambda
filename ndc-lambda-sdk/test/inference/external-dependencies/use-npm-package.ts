
import { emojify } from "node-emoji";

/**
 * @readonly
 */
export function useImportedPackage(s: string): string {
  return emojify(`${s} :t-rex: :heart: NPM`);
}
