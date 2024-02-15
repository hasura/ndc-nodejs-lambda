type ObjectWithIndexSignature = { [name: string]: string }

type ObjectWithPropsAndIndexSignature = {
  propA: string
  propB: string
  [propName: string]: string
}

type MyType1 = {
  [index: number]: string;
};

type MyType2 = {
  [key: string]: number;
};

type IntersectionOfMultipleIndexSigs = MyType1 & MyType2

/** @allowrelaxedtypes */
export function indexSignatureTypesFunction(
  recordType: Record<string, string>,
  inlineSig: { [x: string]: string },
  objWithSig: ObjectWithIndexSignature,
  objWithPropsAndSig: ObjectWithPropsAndIndexSignature,
  intersectionSigs: IntersectionOfMultipleIndexSigs
): string {
  return ""
}
