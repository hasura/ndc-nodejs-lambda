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
