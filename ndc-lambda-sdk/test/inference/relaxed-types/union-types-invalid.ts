type AliasedUnion = string | void;

/** @allowrelaxedtypes */
export function unionTypes(
  numberOrString: number | Promise<string>,
  aliasedUnion: AliasedUnion,
  unionedObjects: { prop1: never } | { prop2: string }
): string {
  return ""
}
