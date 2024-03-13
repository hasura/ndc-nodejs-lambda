type AliasedObjectType = {
  fullName: { firstName: string, surname: string }
  intersectionFullName: { firstName: string } & { surname: string }
  nestedType: {
    coordinates: { x: number, y: number },
    nestedFullName: { firstName: string, surname: string },
    nestedIntersectionFullName: { firstName: string } & { surname: string }
  },
}

type GenericAliasedObjectType<T> = {
  data: T
  nestedAnonymous: { prop: T }
}

/** @readonly */
export function anonymousTypes(
  dob: { year: number, month: number, day: number },
  aliasedObjectType: AliasedObjectType,
  stringGenericAliasedObjectType: GenericAliasedObjectType<string>,
  numberGenericAliasedObjectType: GenericAliasedObjectType<number>,
): { successful: boolean } {
  return { successful: true };
}
