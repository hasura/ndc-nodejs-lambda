
import { emojify } from "node-emoji";

/**
 * @pure
 */
export function useImportedPackage(s: string): string {
  return emojify(`${s} :t-rex: :heart: NPM`);
}
