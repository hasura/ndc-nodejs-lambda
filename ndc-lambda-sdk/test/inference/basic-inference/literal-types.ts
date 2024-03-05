type LiteralProps = {
  literalString: "literal-string",
  literalNumber: 123,
  literalBoolean: true,
  literalBigInt: -123n,
  literalStringEnum: StringEnum.EnumItem
  literalNumericEnum: NumericEnum.EnumItem
  singleItemEnum: SingleItemEnum
}

enum StringEnum {
  EnumItem = "EnumItem",
  SecondEnumItem = "SecondEnumItem"
}

enum NumericEnum {
  EnumItem,
  SecondEnumItem
}

// Single item enums are simplified by the compiler to a literal type
enum SingleItemEnum {
  SingleItem = "SingleItem"
}

export function literalTypes(): LiteralProps {
  return {
    literalString: "literal-string",
    literalNumber: 123,
    literalBoolean: true,
    literalBigInt: -123n,
    literalStringEnum: StringEnum.EnumItem,
    literalNumericEnum: NumericEnum.EnumItem,
    singleItemEnum: SingleItemEnum.SingleItem
  };
}
