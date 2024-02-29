export function mapType(param: Map<string, string>): string {
  return "";
}

export function recordType(param: Record<string, string>): string {
  return "";
}

type ObjectWithIndexSignature = { [name: string]: string }

export function objectWithIndexSignatureType(param: ObjectWithIndexSignature): string {
  return "";
}

type ObjectWithPropsAndIndexSignature = {
  propA: string
  propB: string
  [propName: string]: string
}

export function objectWithPropsAndIndexSignatureType(param: ObjectWithPropsAndIndexSignature): string {
  return "";
}

type MyType1 = {
  [index: number]: string;
};

type MyType2 = {
  [key: string]: number;
};

type IntersectionOfMultipleIndexSigs = MyType1 & MyType2

export function objectWithMultipleIndexSignaturesType(param: IntersectionOfMultipleIndexSigs): string {
  return "";
}
