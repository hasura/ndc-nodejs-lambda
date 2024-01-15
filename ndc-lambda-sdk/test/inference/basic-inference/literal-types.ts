type LiteralProps = {
  literalString: "literal-string",
  literalNumber: 123,
  literalBoolean: true,
  literalBigInt: -123n,
  literalStringEnum: StringEnum.EnumItem
  literalNumericEnum: NumericEnum.EnumItem
}

enum StringEnum {
  EnumItem = "EnumItem"
}

enum NumericEnum {
  EnumItem
}

export function literalTypes(): LiteralProps {
  return {
    literalString: "literal-string",
    literalNumber: 123,
    literalBoolean: true,
    literalBigInt: -123n,
    literalStringEnum: StringEnum.EnumItem,
    literalNumericEnum: NumericEnum.EnumItem,
  };
}
