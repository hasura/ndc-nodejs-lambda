type ObjectWithRelaxedType = {
  prop: string | number
}

/** @allowrelaxedtypes */
export function relaxedTest(param: ObjectWithRelaxedType): string {
  return ""
}

export function strictTest(param: ObjectWithRelaxedType): string {
  return ""
}
