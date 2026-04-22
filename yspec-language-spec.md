# YSpec Language Specification

## 1. Overview

YSpec is a YAML-based structured logic language for representing program behavior in a deterministic, machine-translatable form.

Its purpose is to act as an intermediate representation between:
- natural-language programming intent
- and generated source code

YSpec is designed to be:
- human-readable
- structurally explicit
- easier to parse than free text
- less syntax-heavy than JSON

---

## 2. Design goals

YSpec is intended to provide:

1. **Readable structure**  
   Logic should be inspectable by humans.

2. **Low syntax overhead**  
   The author should express logic without full programming-language syntax.

3. **Deterministic translation**  
   A YSpec document should be transformable into code with minimal ambiguity.

4. **Nested control flow**  
   Conditions, loops, matches, and exception handling must support structured nesting.

5. **Language independence at the spec level**  
   YSpec describes behavior, not target-language syntax.

6. **Composability**  
   Modules, imports, generics, and macros should compose predictably.

---

## 3. Canonical document shapes

YSpec supports exactly one top-level document kind per document.

Allowed top-level kinds:
- `function`
- `module`
- `class`
- `macro`

A document MUST NOT declare more than one of these top-level kinds at the same level.

### 3.1 Function document

Canonical key order:
1. `function`
2. `async`
3. `generics`
4. `inputs`
5. `returns`
6. `logic`

```yaml
function: identity
async: true
generics:
  - T
inputs:
  - name: value
    type: T
returns: T
logic:
  - return: value
```

### 3.2 Module document

Canonical key order:
1. `module`
2. `imports`
3. `exports`
4. `functions`
5. `classes`
6. `macros`
7. `logic`

```yaml
module: math
imports:
  - from: ./helpers.yspec
    symbols:
      - double
exports:
  - add
functions:
  - function: add
    inputs:
      - a
      - b
    logic:
      - return: a + b
```

### 3.3 Class document

Canonical key order:
1. `class`
2. `generics`
3. `extends`
4. `implements`
5. `fields`
6. `methods`

```yaml
class: Box
generics:
  - T
fields:
  - name: value
    type: T
methods:
  - function: unwrap
    returns: T
    logic:
      - return: value
```

### 3.4 Macro document

Canonical key order:
1. `macro`
2. `params`
3. `expandsTo`

```yaml
macro: guardNotNull
params:
  - value
  - fallback
expandsTo:
  - if:
      condition: not value
      then:
        - return: fallback
```

---

## 4. Lexical and naming conventions

### 4.1 Identifiers
Identifiers SHOULD be valid names in the eventual target language.

### 4.2 Expressions
Expression values may be represented as:
- scalar YAML values
- inline expression strings
- structured expression objects such as `await`

### 4.3 Pattern captures
YSpec uses `$name` for captured variables in match patterns.
`_` is the wildcard catch-all.

### 4.4 Naming conventions
- preserve user-provided names when valid
- prefer meaningful neutral names such as `item`, `value`, `result`, `count`
- avoid target-language-specific naming rules at the YSpec level unless codegen has started

---

## 5. Type model

Type annotations are optional unless required by the host environment or requested by the author.

Supported forms may include:
- primitive types: `string`, `number`, `boolean`, `null`
- named types: `User`, `Result`
- generic types: `list<T>`, `map<K, V>`, `optional<T>`

### 5.1 Typed input form

```yaml
inputs:
  - name: a
    type: number
  - name: b
    type: number
```

### 5.2 Return type form

```yaml
returns: number
```

### 5.3 Typed field form

```yaml
fields:
  - name: count
    type: number
    default: 0
```

---

## 6. Statement and expression boundary

A logic block contains statement nodes.
A statement node contains exactly one statement kind.
Expressions are values used inside statements.

Statements:
- `set`
- `if`
- `forEach`
- `return`
- `call`
- `try`
- `raise`
- `match`
- `parallel`

Structured expressions may appear inside statements, such as:
- `await`

---

## 7. Core statement definitions

### 7.1 `set`

```yaml
- set:
    total: 0
```

Assigns a value to a named variable.

### 7.2 `if`

```yaml
- if:
    condition: ready
    then:
      - return: true
    else:
      - return: false
```

### 7.3 `forEach`

```yaml
- forEach:
    item: score
    in: scores
    do:
      - call:
          name: logScore
          args:
            - score
```

### 7.4 `return`

```yaml
- return: result
```

### 7.5 `call`

```yaml
- call:
    name: helper
    args:
      - value
```

---

## 8. Advanced statement definitions

### 8.1 `try`

```yaml
- try:
    do:
      - return: parse(value)
    except:
      - type: ValueError
        then:
          - return: 0
    else:
      - call:
          name: auditSuccess
    finally:
      - call:
          name: cleanup
```

### 8.2 `raise`

```yaml
- raise:
    type: UserLookupError
    message: message
    cause: error
```

### 8.3 `match`

```yaml
- match:
    value: response
    cases:
      - case:
          status: ok
          data: $data
        then:
          - return: data
      - case: _
        then:
          - return: null
```

### 8.4 `parallel`

```yaml
- parallel:
    branches:
      - - call:
            name: loadUser
      - - call:
            name: loadSettings
```

---

## 9. Async semantics

### 9.1 Async function form

```yaml
function: fetchUser
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
  - return: user
```

Semantics:
- `async: true` marks the enclosing function or method as asynchronous
- `await` suspends the current flow until the async result resolves
- `parallel` expresses concurrent work where supported

---

## 10. Module semantics

- one YSpec module corresponds to one explicit module boundary
- `imports` define dependencies
- `exports` define public API
- implicit globals SHOULD be avoided

---

## 11. Class semantics

YSpec classes describe named state plus methods.
They are not required to map to a native class if the target language uses another equivalent structure.

---

## 12. Generic semantics

Generics express relationships between inputs, outputs, fields, and methods.
They SHOULD only be used when type-parameter reuse is part of the intended design.

---

## 13. Macro semantics

Macros are expansion-time transforms.
They MUST expand into normal YSpec before validation and code generation.

---

## 14. Canonical advanced example

```yaml
module: user-service
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
                - return: unknown
```

---

## 15. Translation pipeline

```txt
Natural language -> normalized YSpec -> macro expansion -> validated AST -> target code
```

---

## 16. Summary

YSpec is a YAML-based structured logic language with deterministic, composable forms suitable for human authoring and machine translation.
