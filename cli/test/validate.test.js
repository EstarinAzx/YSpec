/**
 * YSpec Validation Tests
 *
 * Tests every rule from yspec-validation-rules.md:
 * - All invalid examples must fail
 * - All examples from yspec-examples.md must pass
 * - All golden examples must pass
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';

// Helper: parse + validate, return errors
function check(yamlStr) {
  const doc = parse(yamlStr);
  return validate(doc);
}

// Helper: should be valid
function expectValid(yamlStr, label) {
  it(label, () => {
    const errors = check(yamlStr);
    assert.equal(errors.length, 0, `Expected valid but got: ${errors.map(e => e.toString()).join(', ')}`);
  });
}

// Helper: should be invalid
function expectInvalid(yamlStr, label, expectedCategory) {
  it(label, () => {
    let errors;
    try {
      errors = check(yamlStr);
    } catch (e) {
      // Parse-level errors count as invalid
      if (expectedCategory) {
        assert.ok(e.category === expectedCategory, `Expected ${expectedCategory} but got ${e.category}`);
      }
      return;
    }
    assert.ok(errors.length > 0, 'Expected errors but got none');
    if (expectedCategory) {
      assert.ok(
        errors.some(e => e.category === expectedCategory),
        `Expected ${expectedCategory} but got: ${errors.map(e => e.category).join(', ')}`
      );
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Invalid examples from validation-rules.md
// ═══════════════════════════════════════════════════════════════════════════

describe('Invalid examples from validation-rules.md', () => {

  expectInvalid(
    `inputs:\n  - value`,
    'No top-level kind',
    'TopLevelShapeError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - if:\n      condition: ready`,
    'Missing then in if',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `module: test\nimports:\n  - from: ./math.yspec`,
    'Malformed import (missing symbols)',
    'InvalidImportError'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Valid examples from yspec-examples.md
// ═══════════════════════════════════════════════════════════════════════════

describe('Valid examples from yspec-examples.md', () => {

  expectValid(
    `function: add\ninputs:\n  - a\n  - b\nlogic:\n  - return: a + b`,
    '1. Basic function'
  );

  expectValid(
    `function: add\ninputs:\n  - name: a\n    type: number\n  - name: b\n    type: number\nreturns: number\nlogic:\n  - return: a + b`,
    '2. Typed function'
  );

  expectValid(
    `function: sumPositiveNumbers
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
  - return: total`,
    '3. Loop and condition'
  );

  expectValid(
    `module: math
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
      - return: a - b`,
    '4. Module with exports'
  );

  expectValid(
    `module: app
imports:
  - from: ./math.yspec
    symbols:
      - add
logic:
  - return: add(1, 2)`,
    '5. Imports'
  );

  expectValid(
    `class: Counter
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
      - return: count`,
    '6. Class with method'
  );

  expectValid(
    `function: parseCount
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
              - value`,
    '7. Exception handling'
  );

  expectValid(
    `function: fetchUser
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
  - return: user`,
    '8. Async function with await'
  );

  expectValid(
    `function: loadDashboard
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
                    - userId
  - return: "{ user: user, notifications: notifications }"`,
    '9. Parallel async work'
  );

  expectValid(
    `function: describeResult
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
            - return: unknown`,
    '10. Pattern matching'
  );

  expectValid(
    `function: first
generics:
  - T
inputs:
  - name: items
    type: "list<T>"
returns: T
logic:
  - return: items[0]`,
    '11. Generic function'
  );

  expectValid(
    `class: Box
generics:
  - T
fields:
  - name: value
    type: T
methods:
  - function: unwrap
    returns: T
    logic:
      - return: value`,
    '12. Generic class'
  );

  expectValid(
    `macro: guardNotNull
params:
  - value
  - fallback
expandsTo:
  - if:
      condition: not value
      then:
        - return: fallback`,
    '13. Macro'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Golden examples from yspec-golden-examples.md
// ═══════════════════════════════════════════════════════════════════════════

describe('Golden examples', () => {

  expectValid(
    `function: add\ninputs:\n  - a\n  - b\nlogic:\n  - return: a + b`,
    'Golden 1: Straightforward function'
  );

  expectValid(
    `function: firstPassingScore
inputs:
  - scores
logic:
  - forEach:
      item: score
      in: scores
      do:
        - if:
            condition: score >= 50
            then:
              - return: score
  - return: null`,
    'Golden 2: Iteration and fallback'
  );

  expectValid(
    `function: fetchUser
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
  - return: user`,
    'Golden 3: Async external fetch'
  );

  expectValid(
    `function: parseCount
inputs:
  - value
logic:
  - try:
      do:
        - return: toInt(value)
      except:
        - type: ValueError
          then:
            - return: 0`,
    'Golden 4: Failure recovery'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Advanced canonical example from language spec
// ═══════════════════════════════════════════════════════════════════════════

describe('Advanced canonical example', () => {

  expectValid(
    `module: user-service
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
                - return: unknown`,
    'Full advanced canonical example from language spec'
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge case validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Edge case validation', () => {

  expectInvalid(
    `function: test\nmodule: test\nlogic:\n  - return: 1`,
    'Multiple top-level kinds (function + module)',
    'TopLevelShapeError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - forEach:\n      item: x\n      in: items`,
    'forEach missing do block',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - try:\n      except:\n        - type: Error\n          then:\n            - return: 0`,
    'try missing do block',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - raise:\n      message: oops`,
    'raise missing type',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - match:\n      value: x`,
    'match missing cases',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `function: test\nlogic:\n  - parallel:\n      branches: []`,
    'parallel with empty branches',
    'MissingRequiredFieldError'
  );

  expectInvalid(
    `macro: test\nparams:\n  - x`,
    'macro missing expandsTo',
    'MissingRequiredFieldError'
  );
});
