# YSpec Validation Rules

This document defines what is valid and invalid YSpec.

## Structural validation

A YSpec document is valid only if:
1. exactly one top-level document kind is selected
2. required keys for that document kind are present
3. logic-containing keys contain lists of statement nodes
4. every statement node has exactly one statement kind
5. nested blocks are lists of valid statement nodes
6. import nodes contain `from` and `symbols`
7. field nodes contain `name`
8. macro nodes contain `macro` and `expandsTo`

## Statement validation

### set
- must contain exactly one assignment target in the mapping

### if
- must contain `condition` and `then`
- `else` is optional

### forEach
- must contain `item`, `in`, and `do`

### return
- must contain a return expression

### call
- must contain `name`
- `args` must be a list if present

### try
- must contain `do`
- each `except` entry must contain `type` and `then`

### raise
- must contain `type`

### match
- must contain `value` and `cases`
- each case must contain `case` and `then`

### parallel
- must contain `branches`
- each branch must be a list of statement nodes

## Invalid examples

### Invalid: multiple statement kinds in one node
```yaml
- set:
    total: 0
  return: total
```

### Invalid: missing `then`
```yaml
- if:
    condition: ready
```

### Invalid: malformed import
```yaml
imports:
  - from: ./math.yspec
```

### Invalid: no top-level kind
```yaml
inputs:
  - value
logic:
  - return: value
```

## Ambiguity rejection rules

Reject generation and ask for clarification when:
- two different top-level shapes are equally plausible
- a fallback or failure path is required but unspecified
- a class/module boundary affects semantics and cannot be safely normalized
- the requested data shape for `match` is underdetermined

## Error categories

Recommended validation categories:
- `TopLevelShapeError`
- `MissingRequiredFieldError`
- `InvalidStatementNodeError`
- `InvalidBlockError`
- `InvalidImportError`
- `InvalidPatternError`
- `AmbiguousIntentError`

## Recovery guidance for AI generators

When validation fails:
1. keep the document shape if it is still correct
2. repair the smallest invalid node
3. do not rewrite unrelated sections
4. if ambiguity caused the failure, ask a narrow clarifying question
