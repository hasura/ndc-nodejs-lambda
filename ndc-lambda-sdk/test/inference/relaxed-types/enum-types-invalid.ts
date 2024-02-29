type StringLiteralEnum = "1st" | "2nd" | Promise<"3rd">

/**
 * @readonly
 * @allowrelaxedtypes
 */
export function enumTypesFunction(
  stringLiteralEnum: StringLiteralEnum,
  inlineStringLiteralEnum: "1st" | "2nd" | void,
): string {
  return ""
}
