# YSpec Schema Reference

This file defines the machine-oriented node model for YSpec.

## Top-level node kinds

- `function`
- `module`
- `class`
- `macro`

## Function node

Required:
- `function`
- `logic`

Optional:
- `async`
- `generics`
- `inputs`
- `returns`

Canonical form:

```yaml
function: name
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

## Module node

Required:
- `module`

Optional:
- `imports`
- `exports`
- `functions`
- `classes`
- `macros`
- `logic`

## Class node

Required:
- `class`

Optional:
- `generics`
- `fields`
- `methods`
- `extends`
- `implements`

## Macro node

Required:
- `macro`
- `expandsTo`

Optional:
- `params`

## Field node

Required:
- `name`

Optional:
- `type`
- `default`

## Import node

Required:
- `from`
- `symbols`

## Statement node kinds

- `set`
- `if`
- `forEach`
- `return`
- `call`
- `try`
- `raise`
- `match`
- `parallel`

## Statement node forms

### set
```yaml
- set:
    name: expression
```

### if
```yaml
- if:
    condition: expression
    then:
      - statement
    else:
      - statement
```

### forEach
```yaml
- forEach:
    item: item
    in: source
    do:
      - statement
```

### return
```yaml
- return: expression
```

### call
```yaml
- call:
    name: callable
    args:
      - expression
```

### try
```yaml
- try:
    do:
      - statement
    except:
      - type: ErrorType
        then:
          - statement
    else:
      - statement
    finally:
      - statement
```

### raise
```yaml
- raise:
    type: ErrorType
    message: expression
    cause: expression
```

### match
```yaml
- match:
    value: expression
    cases:
      - case: pattern
        if: expression
        then:
          - statement
```

### parallel
```yaml
- parallel:
    branches:
      - - statement
      - - statement
```

## Pattern node forms

Supported patterns:
- scalar literal
- object pattern
- sequence pattern
- `$capture`
- `_`

Example:

```yaml
case:
  status: ok
  data: $data
```

## Type annotation forms

Supported forms:
- primitive scalar type
- named type
- generic type expression such as `list<T>`

## Async expression form

```yaml
await:
  call: api.getUser
  args:
    - id
```

## Macro expansion node

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
