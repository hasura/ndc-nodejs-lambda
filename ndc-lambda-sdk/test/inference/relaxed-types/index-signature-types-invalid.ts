type ObjectWithIndexSignature = { [name: string]: never }

type ObjectWithPropsAndIndexSignature = {
  propA: Promise<string>
  propB: Promise<string>
  [propName: string]: Promise<string>
}

type MyType1 = {
  [index: number]: string;
};

type MyType2 = {
  [key: string]: Promise<string>;
};

type IntersectionOfMultipleIndexSigs = MyType1 & MyType2

/** @allowrelaxedtypes */
export function indexSignatureTypesFunction(
  recordType: Record<string, void>,
  inlineSig: { [x: string]: undefined },
  objWithSig: ObjectWithIndexSignature,
  objWithPropsAndSig: ObjectWithPropsAndIndexSignature,
  intersectionSigs: IntersectionOfMultipleIndexSigs
): string {
  return ""
}
