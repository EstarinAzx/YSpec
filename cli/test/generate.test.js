/**
 * YSpec Code Generation Tests
 *
 * Tests that YSpec examples produce correct JavaScript output.
 * Each test parses a YSpec string, generates JS, and checks the output
 * contains expected patterns.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';
import { generate } from '../src/generators/javascript.js';

// Helper: parse + validate + generate
function gen(yamlStr) {
  const doc = parse(yamlStr);
  const errors = validate(doc);
  assert.equal(errors.length, 0, `Validation errors: ${errors.map(e => e.toString()).join(', ')}`);
  return generate(doc);
}

// Helper: check output contains pattern
function expectContains(output, pattern, msg) {
  assert.ok(output.includes(pattern), `${msg}\nExpected to find: ${pattern}\nIn output:\n${output}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Basic function generation
// ═══════════════════════════════════════════════════════════════════════════

describe('Basic function generation', () => {

  it('generates a simple add function', () => {
    const output = gen(`function: add\ninputs:\n  - a\n  - b\nlogic:\n  - return: a + b`);
    expectContains(output, 'function add(a, b)', 'function signature');
    expectContains(output, 'return a + b;', 'return statement');
  });

  it('generates a typed function with JSDoc', () => {
    const output = gen(`function: add
inputs:
  - name: a
    type: number
  - name: b
    type: number
returns: number
logic:
  - return: a + b`);
    expectContains(output, '@param {number} a', 'JSDoc param a');
    expectContains(output, '@param {number} b', 'JSDoc param b');
    expectContains(output, '@returns {number}', 'JSDoc returns');
    expectContains(output, 'function add(a, b)', 'function signature');
  });

  it('generates variable declaration and reassignment', () => {
    const output = gen(`function: sumPositiveNumbers
inputs:
  - numbers
logic:
  - set:
      total: 0
  - forEach:
      item: number
      in: numbers
      do:
        - if:
            condition: number > 0
            then:
              - set:
                  total: total + number
  - return: total`);
    expectContains(output, 'let total = 0;', 'variable declaration');
    expectContains(output, 'total = total + number;', 'variable reassignment');
    expectContains(output, 'for (const number of numbers)', 'forEach loop');
    expectContains(output, 'if (number > 0)', 'condition');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Module generation
// ═══════════════════════════════════════════════════════════════════════════

describe('Module generation', () => {

  it('generates ES module with imports and exports', () => {
    const output = gen(`module: math
exports:
  - add
  - subtract
functions:
  - function: add
    inputs:
      - a
      - b
    logic:
      - return: a + b
  - function: subtract
    inputs:
      - a
      - b
    logic:
      - return: a - b`);
    expectContains(output, 'export function add(a, b)', 'exported add');
    expectContains(output, 'export function subtract(a, b)', 'exported subtract');
  });

  it('converts .yspec imports to .js', () => {
    const output = gen(`module: app
imports:
  - from: ./math.yspec
    symbols:
      - add
logic:
  - return: add(1, 2)`);
    expectContains(output, "import { add } from './math.js';", '.yspec → .js import');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Class generation
// ═══════════════════════════════════════════════════════════════════════════

describe('Class generation', () => {

  it('generates a class with constructor and methods', () => {
    const output = gen(`class: Counter
fields:
  - name: count
    type: number
    default: 0
methods:
  - function: increment
    returns: number
    logic:
      - set:
          count: count + 1
      - return: count`);
    expectContains(output, 'class Counter', 'class declaration');
    expectContains(output, 'constructor()', 'constructor');
    expectContains(output, 'this.count = 0;', 'field initialization');
    expectContains(output, 'this.count = this.count + 1;', 'field assignment in method');
  });

  it('generates generic class with JSDoc @template', () => {
    const output = gen(`class: Box
generics:
  - T
fields:
  - name: value
    type: T
methods:
  - function: unwrap
    returns: T
    logic:
      - return: value`);
    expectContains(output, '@template T', 'generic JSDoc');
    expectContains(output, 'class Box', 'class name');
    expectContains(output, 'this.value', 'field access');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Exception handling
// ═══════════════════════════════════════════════════════════════════════════

describe('Exception handling', () => {

  it('generates try/catch with typed handler', () => {
    const output = gen(`function: parseCount
inputs:
  - value
logic:
  - try:
      do:
        - return: toInt(value)
      except:
        - type: ValueError
          then:
            - return: 0
      finally:
        - call:
            name: auditParse
            args:
              - value`);
    expectContains(output, 'try {', 'try block');
    expectContains(output, 'catch (error)', 'catch clause');
    expectContains(output, 'error instanceof ValueError', 'typed check');
    expectContains(output, 'return 0;', 'fallback return');
    expectContains(output, 'finally {', 'finally block');
    expectContains(output, 'auditParse(value);', 'finally call');
  });

  it('generates throw with error type', () => {
    const output = gen(`function: fail
inputs:
  - message
logic:
  - raise:
      type: UserLookupError
      message: message`);
    expectContains(output, 'throw new UserLookupError(message)', 'throw statement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Async generation
// ═══════════════════════════════════════════════════════════════════════════

describe('Async generation', () => {

  it('generates async function with await', () => {
    const output = gen(`function: fetchUser
async: true
inputs:
  - id
logic:
  - set:
      user:
        await:
          call: api.getUser
          args:
            - id
  - return: user`);
    expectContains(output, 'async function fetchUser(id)', 'async function');
    expectContains(output, 'await api.getUser(id)', 'await call');
  });

  it('generates parallel as Promise.all', () => {
    const output = gen(`function: loadDashboard
async: true
inputs:
  - userId
logic:
  - parallel:
      branches:
        - - set:
              user:
                await:
                  call: api.getUser
                  args:
                    - userId
        - - set:
              notifications:
                await:
                  call: api.getNotifications
                  args:
                    - userId`);
    expectContains(output, 'async function loadDashboard', 'async function');
    expectContains(output, 'Promise.all', 'Promise.all');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Pattern matching
// ═══════════════════════════════════════════════════════════════════════════

describe('Pattern matching', () => {

  it('generates chained if/else from match', () => {
    const output = gen(`function: describeResult
inputs:
  - result
logic:
  - match:
      value: result
      cases:
        - case:
            status: ok
            data: $data
          then:
            - return: data
        - case:
            status: error
            message: $message
          then:
            - return: message
        - case: _
          then:
            - return: unknown`);
    expectContains(output, "result.status === 'ok'", 'status check ok');
    expectContains(output, 'let data = result.data', 'capture data');
    expectContains(output, "result.status === 'error'", 'status check error');
    expectContains(output, 'let message = result.message', 'capture message');
    expectContains(output, 'else {', 'wildcard else');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Generics
// ═══════════════════════════════════════════════════════════════════════════

describe('Generics', () => {

  it('generates @template JSDoc for generic function', () => {
    const output = gen(`function: first
generics:
  - T
inputs:
  - name: items
    type: "list<T>"
returns: T
logic:
  - return: items[0]`);
    expectContains(output, '@template T', 'template annotation');
    expectContains(output, '@returns {T}', 'return type');
    expectContains(output, 'return items[0];', 'array access');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Full advanced example from language spec
// ═══════════════════════════════════════════════════════════════════════════

describe('Advanced canonical example codegen', () => {

  it('generates the full user-service module', () => {
    const output = gen(`module: user-service
imports:
  - from: ./api.yspec
    symbols:
      - getUser
exports:
  - fetchDisplayName
functions:
  - function: fetchDisplayName
    async: true
    inputs:
      - name: id
        type: string
    returns: string
    logic:
      - try:
          do:
            - set:
                response:
                  await:
                    call: getUser
                    args:
                      - id
            - match:
                value: response
                cases:
                  - case:
                      status: ok
                      data:
                        name: $name
                    then:
                      - return: name
                  - case:
                      status: error
                      message: $message
                    then:
                      - raise:
                          type: UserLookupError
                          message: message
          except:
            - type: NetworkError
              then:
                - return: unknown`);
    expectContains(output, "import { getUser } from './api.js';", 'import');
    expectContains(output, 'export async function fetchDisplayName(id)', 'exported async function');
    expectContains(output, 'await getUser(id)', 'await call');
    expectContains(output, "response.status === 'ok'", 'match ok');
    expectContains(output, 'throw new UserLookupError(message)', 'raise');
    expectContains(output, 'error instanceof NetworkError', 'catch handler');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Inline function/class/const syntax (v2)
// ═══════════════════════════════════════════════════════════════════════════

describe('Inline declarations (v2 syntax)', () => {

  it('generates inline function definitions', () => {
    const output = gen(`module: test
function greet:
  inputs:
    - name: string
  logic: |
    console.log(\`Hello \${name}\`)
logic: |
  greet("World")`);
    expectContains(output, 'function greet(name)', 'inline function');
    expectContains(output, 'greet("World");', 'function call');
  });

  it('generates inline const declarations', () => {
    const output = gen(`module: test
const SPEED: 30
const MAX: 100
logic: |
  console.log(SPEED)`);
    expectContains(output, 'const SPEED = 30;', 'const SPEED');
    expectContains(output, 'const MAX = 100;', 'const MAX');
  });

  it('generates inline let declarations', () => {
    const output = gen(`module: test
let counter: 0
logic: |
  counter = counter + 1`);
    expectContains(output, 'let counter = 0;', 'let counter');
  });

  it('mixes inline and block const', () => {
    const output = gen(`module: test
const INLINE: 42
const:
  BLOCK: 99
logic: |
  console.log(INLINE + BLOCK)`);
    expectContains(output, 'const INLINE = 42;', 'inline const');
    expectContains(output, 'const BLOCK = 99;', 'block const');
  });

  it('correctly quotes string literal values', () => {
    const output = gen(`module: test
const APP_NAME: "Demo"
const VERSION: "1.0.0"
const MAX: 3
const FLAG: true
logic: |
  console.log(APP_NAME)`);
    expectContains(output, "const APP_NAME = 'Demo';", 'string quoted');
    expectContains(output, "const VERSION = '1.0.0';", 'version string quoted');
    expectContains(output, 'const MAX = 3;', 'number unquoted');
    expectContains(output, 'const FLAG = true;', 'boolean unquoted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NPM and builtin imports
// ═══════════════════════════════════════════════════════════════════════════

describe('NPM and builtin imports', () => {

  it('generates default npm import', () => {
    const output = gen(`module: server
imports:
  - from: express
logic: |
  const app = express()`);
    expectContains(output, "import express from 'express';", 'npm default import');
  });

  it('generates named npm import', () => {
    const output = gen(`module: server
imports:
  - from: express
    symbols: [Router]
logic: |
  const r = Router()`);
    expectContains(output, "import { Router } from 'express';", 'npm named import');
  });

  it('generates aliased default import', () => {
    const output = gen(`module: server
imports:
  - from: express
    as: app
logic: |
  app.listen(3000)`);
    expectContains(output, "import app from 'express';", 'aliased import');
  });

  it('generates node builtin import', () => {
    const output = gen(`module: fileUtils
imports:
  - from: node:fs
    symbols: [readFile, writeFile]
logic: |
  readFile("test.txt")`);
    expectContains(output, "import { readFile, writeFile } from 'node:fs';", 'node builtin');
  });

  it('does not rewrite npm import paths', () => {
    const output = gen(`module: app
imports:
  - from: express
logic: |
  console.log("ok")`);
    // Should NOT try to do .yspec -> .js conversion on npm packages
    assert.ok(!output.includes('express.js'), 'should not rewrite npm path');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Script mode
// ═══════════════════════════════════════════════════════════════════════════

describe('Script mode', () => {

  it('generates from bare logic block', () => {
    const output = gen(`logic: |
  console.log("Hello")`);
    expectContains(output, 'console.log("Hello");', 'bare logic output');
  });

  it('generates script with inline functions', () => {
    const output = gen(`function greet:
  inputs:
    - name: string
  logic: |
    console.log(name)
logic: |
  greet("World")`);
    expectContains(output, 'function greet(name)', 'script function');
    expectContains(output, 'greet("World");', 'script call');
  });
});
