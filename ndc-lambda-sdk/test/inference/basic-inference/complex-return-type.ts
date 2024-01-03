type Result = {
  num: number,
  str: string,
  bod: string
}

export async function complex(a: number, b: number, c?: string): Promise<Result> {
  const num = a + b;
  const msg = `${c ?? 'Addition'}: ${num}`;
  const str = `Yo: ${msg}`;
  const res = await fetch('https://httpbin.org/get');
  const bod = await res.text();

  return {
    num,
    str,
    bod
  }
}
