import * as dep from './imported-types.dep';
import * as commander from 'commander';

/** @readonly */
export function npmTypeImport(): commander.HelpContext {
  return { error: false };
}

/** @readonly */
export function localTypeImport(): dep.AnotherType {
  return { prop: "" };
}

type Foo = {
  x: boolean,
  y: dep.Foo
}

export function conflictWithLocalImport(): Foo {
  return {
    x: true,
    y: {
      a: 'hello',
      b: 33
    }
  }
}

type ErrorOptions = {
  retval: number
}

/** @readonly */
export function conflictWithNpmImport(myErrorOptions: ErrorOptions): commander.ErrorOptions {
  return { exitCode: myErrorOptions.retval };
}
