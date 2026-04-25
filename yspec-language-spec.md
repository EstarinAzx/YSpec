# YSpec Language Specification

## 1. Overview

YSpec is a hybrid language combining YAML structure with JavaScript-style logic blocks. It transpiles to JavaScript.

YSpec has **two authoring modes** that can be mixed freely:

- **Structured mode** — YAML-based AST for declarative constructs (functions, classes, variables)
- **Logic mode** — indentation-based code blocks (`logic: |`) for imperative code

Both modes are first-class. Structured mode defines *what things are*. Logic mode defines *what things do*.

---

## 2. Document shapes

Every `.yspec` file is one of these shapes:

### 2.1 Module (explicit)

The primary document shape. Declares a named module with functions, classes, variables, and logic.

```yaml
module: my-app
```

### 2.2 Script (implicit)

A file with `logic: |` but no `module:`, `function:`, or `class:` top-level key. Treated as an anonymous module internally.

```yaml
logic: |
  console.log("Hello World")
```

### 2.3 Standalone function / class / macro

A file containing a single top-level `function:`, `class:`, or `macro:` key. Used when a file defines exactly one entity.

```yaml
function: add
inputs:
  - a: number
  - b: number
logic:
  - return: a + b
```

A document MUST NOT declare more than one top-level shape.

---

## 3. Declarations

### 3.1 Functions

**Inline syntax** (preferred for modules):

```yaml
function greet:
  inputs:
    - name: string
  logic: |
    console.log(`Hello ${name}!`)
```

**List syntax** (inside `functions:` block):

```yaml
functions:
  - function: greet
    inputs:
      - name: string
    logic: |
      console.log(`Hello ${name}!`)
```

Both are equivalent. Inline syntax is more ergonomic.

**Function properties:**

| Property | Required | Description |
|----------|----------|-------------|
| `inputs` | No | Parameters with optional types |
| `returns` | No | Return type annotation |
| `async` | No | Mark as async function |
| `generics` | No | Type parameters |
| `logic` | Yes | Function body |

### 3.2 Classes

**Inline syntax:**

```yaml
class Dog:
  fields:
    - name: name
      type: string
    - name: age
      type: number
      default: 0
  methods:
    - function: bark
      logic: |
        console.log(`${name} says Woof!`)
```

**Field rules:**
- Fields **without** `default` become constructor parameters
- Fields **with** `default` are auto-initialized
- Field names inside methods auto-resolve to `this.` in generated JS

### 3.3 Variables

**Inline syntax** (preferred):

```yaml
const MAX_RETRIES: 3
const APP_NAME: "Demo"
let counter: 0
```

**Block syntax:**

```yaml
const:
  MAX_RETRIES: 3
  APP_NAME: "Demo"
let:
  counter: 0
```

Both are equivalent. Inline is preferred for readability.

**Value rules:**
- YAML scalar values are treated as **literals** (strings get quoted, numbers/booleans pass through)
- For computed values, use `logic: |` blocks

### 3.4 Imports

```yaml
imports:
  # Local YSpec import (named)
  - from: ./utils.yspec
    symbols: [formatDate, parseId]

  # NPM package (default import)
  - from: express

  # NPM package (aliased default)
  - from: express
    as: app

  # NPM package (named imports)
  - from: express
    symbols: [Router, json]

  # Node builtin
  - from: node:fs
    symbols: [readFile, writeFile]
```

**Import rules:**
- Local imports (starting with `./` or `../`) require `symbols`
- NPM imports (no path prefix) auto-generate default imports
- Node builtins (starting with `node:`) work like NPM imports
- Local `.yspec` paths are rewritten to `.js` in output

### 3.5 Exports

```yaml
exports:
  - add
  - subtract
```

Listed names get `export` prefix in generated JS.

---

## 4. Logic blocks

The `logic: |` block is YSpec's primary code authoring surface. It uses indentation-based syntax with JS-compatible expressions.

### 4.1 Variables

```yaml
logic: |
  const name = "World"
  let count = 0
  count = count + 1
```

### 4.2 Control flow

```yaml
logic: |
  if status === "active":
    console.log("Active!")
  elseif status === "pending":
    console.log("Waiting...")
  else:
    console.log("Unknown")
```

### 4.3 Loops

```yaml
logic: |
  for item in items:
    console.log(item.name)
```

### 4.4 Exception handling

```yaml
logic: |
  try:
    const data = JSON.parse(raw)
  catch SyntaxError as e:
    console.error("Bad JSON:", e.message)
  finally:
    cleanup()
```

### 4.5 Function calls

```yaml
logic: |
  console.log("Hello")
  const result = fetchUser("42")
```

### 4.6 Returns

```yaml
logic: |
  return result
```

### 4.7 Raw JS expressions

Any line not matching a YSpec pattern passes through as raw JS:

```yaml
logic: |
  const arr = [1, 2, 3].map(x => x * 2)
  items.forEach(item => {
    console.log(item)
  })
```

Multi-line expressions with brackets (`()`, `[]`, `{}`) are automatically joined.

---

## 5. Structured logic (AST mode)

For tooling and machine generation, logic can also be expressed as structured YAML:

### 5.1 Statement nodes

```yaml
logic:
  - set:
      total: 0
  - if:
      condition: total > 0
      then:
        - return: total
      else:
        - return: 0
  - forEach:
      item: score
      in: scores
      do:
        - call:
            name: logScore
            args:
              - score
  - return: result
```

### 5.2 Available statement types

| Statement | Description |
|-----------|-------------|
| `set` | Variable assignment |
| `if` | Conditional (with `then`, `else`, `elseif`) |
| `forEach` | Loop over collection |
| `return` | Return value |
| `call` | Function call |
| `try` | Exception handling (with `except`, `finally`) |
| `raise` | Throw exception |
| `match` | Pattern matching |
| `parallel` | Concurrent execution (`Promise.all`) |

### 5.3 Await expression

```yaml
- set:
    user:
      await:
        call: api.getUser
        args:
          - id
```

### 5.4 Pattern matching

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

`$name` captures a value. `_` is the wildcard.

---

## 6. Type model

Type annotations are optional.

```yaml
inputs:
  - name: value
    type: number

returns: string

fields:
  - name: count
    type: number
    default: 0
```

Supported type forms:
- Primitives: `string`, `number`, `boolean`, `null`
- Named types: `User`, `Result`
- Generic types: `list<T>`, `map<K, V>`, `optional<T>`

---

## 7. Generics

```yaml
function: first
generics:
  - T
inputs:
  - name: items
    type: "list<T>"
returns: T
logic:
  - return: items[0]
```

Transpiles to `@template T` JSDoc annotations.

---

## 8. Macros

Macros are expansion-time transforms. They expand into normal YSpec before code generation.

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

## 9. Translation pipeline

```
.yspec file → YAML parse → AST extraction → validation → JS generation → .js file
```

1. **Parse** — YAML structure + logic blocks parsed into AST
2. **Validate** — structural rules checked
3. **Generate** — AST transpiled to JavaScript (ES modules)

---

## 10. Authoring guidance

### When to use `logic: |` (recommended for humans)

- Writing imperative code
- Complex expressions, arrow functions, method chains
- Anything that feels natural as code

### When to use structured YAML (recommended for tooling)

- Machine-generated YSpec
- When structure needs to be inspected/transformed before codegen
- Pattern matching, parallel execution, macro expansion

### Mixing modes

Both modes can coexist in the same file:

```yaml
module: app

const API_URL: "https://api.example.com"

function fetchUser:
  async: true
  inputs:
    - id: string
  logic: |
    const res = await fetch(`${API_URL}/users/${id}`)
    return res.json()

logic: |
  const user = await fetchUser("42")
  console.log(user.name)
```

The YAML structure declares *what exists*. The `logic: |` blocks define *what happens*.
