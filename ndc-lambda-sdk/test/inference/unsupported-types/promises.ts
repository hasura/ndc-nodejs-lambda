export function promiseParam(input: Promise<string>): string {
  return ""
}

type Bar = {
  str: Promise<string>
}

export function nestedPromiseInParam(x: Bar): string {
  return "";
}

export function nestedPromiseInRetval(): Bar {
  return { str: Promise.resolve("") };
}
