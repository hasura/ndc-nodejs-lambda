import * as dep from './conflict-from-import.dep';

type Foo = {
  x: boolean,
  y: dep.Foo
}

export function foo(): Foo {
  return {
    x: true,
    y: {
      a: 'hello',
      b: 33
    }
  }
}
