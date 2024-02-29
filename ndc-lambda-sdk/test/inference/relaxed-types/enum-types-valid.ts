enum StringEnum {
  First = "First",
  Second = "Second"
}

enum NumberEnum {
  First = 1,
  Second = 2
}

enum MixedEnum {
  Dog = "Dog",
  Cat = "Cat",
  Other = 1234,
}

const enum ConstEnum {
  First = "first",
  Second = "second",
}

enum ComputedEnum {
  Gross = "Gross".length,
  Foul = "Foul".length
}

enum ComputedSingleItemEnum {
  Single = "Single".length
}

type StringLiteralEnum = "1st" | "2nd"

type NumberLiteralEnum = 0 | 1 | 2

type MixedLiteralEnum = true | false | 0 | 1 | "1st" | "2nd"

const ConstObjEnumVal = {
  Plant: "plant",
  Animal: "animal"
} as const;

type ConstObjEnum = typeof ConstObjEnumVal[keyof typeof ConstObjEnumVal]

/**
 * @readonly
 * @allowrelaxedtypes
 */
export function enumTypesFunction(
  stringEnum: StringEnum,
  numberEnum: NumberEnum,
  mixedEnum: MixedEnum,
  constEnum: ConstEnum,
  computedEnum: ComputedEnum,
  computedSingleItemEnum: ComputedSingleItemEnum,
  stringLiteralEnum: StringLiteralEnum,
  stringLiteralEnumMaybe: StringLiteralEnum | undefined,
  inlineStringLiteralEnum: "1st" | "2nd",
  inlineStringLiteralEnumMaybe: "1st" | "2nd" | null,
  numberLiteralEnum: NumberLiteralEnum,
  numberLiteralEnumMaybe: NumberLiteralEnum | null,
  inlineNumberLiteralEnum: 0 | 1 | 2,
  inlineNumberLiteralEnumMaybe: 0 | 1 | 2 | undefined,
  mixedLiteralEnum: MixedLiteralEnum,
  mixedLiteralEnumMaybe: MixedLiteralEnum | undefined | null,
  inlineMixedLiteralEnum: true | 1 | "first",
  inlineMixedLiteralEnumMaybe: true | 1 | "first" | undefined | null,
  constObjEnum: ConstObjEnum,
): string {
  return ""
}
