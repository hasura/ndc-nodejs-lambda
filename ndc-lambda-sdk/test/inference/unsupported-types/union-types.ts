type AliasedUnion = string | boolean;

export function unionTypes(
  numberOrString: number | string,
  aliasedUnion: AliasedUnion,
  unionedObjects: { prop1: string } | { prop2: string }
): string {
  return ""
}
