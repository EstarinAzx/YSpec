# YSpec Normalization Rules

This document defines deterministic mappings from user language to YSpec.

## Purpose

A user may describe intent loosely. Normalization converts that wording into canonical YSpec structures.

## General principle

Normalize wording into the simplest YSpec construct that preserves behavior.

## Core mappings

### Function creation
- "make a function"
- "create a function"
- "write a function"

Normalize to:

```yaml
function: <name>
inputs:
  - ...
logic:
  - ...
```

### Iteration
- "loop through"
- "go over each"
- "for every item"

Normalize to `forEach`.

```yaml
- forEach:
    item: item
    in: items
    do:
      - ...
```

### Conditional branching
- "if"
- "when"
- "if this is true"

Normalize to `if`.

### Failure handling
- "if this fails"
- "on error"
- "if request throws"

Normalize to `try` / `except` when the request describes failure recovery, not just a boolean branch.

### Async behavior
- "fetch"
- "await"
- "load from api"
- "call this asynchronously"

Normalize to `async: true` plus `await` if the operation is described as asynchronous or external and waiting is required.

### Pattern matching
- "depending on the shape"
- "if status is ok return data, if error return message"
- "match on result"

Normalize to `match` when the user is branching on structured data shapes instead of one simple boolean condition.

### Generics
- "works for any type"
- "same input and output type"
- "generic"

Normalize to `generics` only when reuse across types is requested.

### Macros
- "template"
- "reusable expansion"
- "generate the same guard each time"

Normalize to `macro` only when the user wants a reusable expansion-time pattern.

## Precedence rules

When more than one construct seems possible, use this order:

1. `if` over `match` for a single boolean condition
2. `match` over chained `if` when structure/shape is central
3. `function` over `module` when only one callable unit is requested
4. `module` over `class` when grouping behavior without state
5. `class` only when named state plus methods is explicit
6. `try` / `except` over `if` only when failure semantics are described
7. `generics` only when type relationships matter
8. `macro` only when reuse at expansion-time matters

## Ambiguity that requires clarification

Ask for clarification if:
- the requested return value is not inferable
- the failure path changes meaningfully depending on interpretation
- the user may want either a class or a module and both are equally plausible
- multiple target data shapes would produce different valid `match` structures

## Ambiguity that should be normalized silently

Do not ask for clarification when:
- a plain loop obviously means `forEach`
- a straightforward branch obviously means `if`
- one named behavior obviously means `function`
- explicit API loading clearly implies async waiting behavior

## Expression normalization

Prefer concise expression values.

Examples:
- "return their sum" -> `a + b`
- "get the first item" -> `items[0]`
- "add one to count" -> `count + 1`
- "if there is no user" -> `not user`

## Naming normalization

Preserve user-provided names when valid.
If a name is missing:
- use generic but meaningful names such as `item`, `value`, `result`, `count`
- avoid target-language-specific naming conventions at the YSpec level
