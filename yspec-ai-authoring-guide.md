# YSpec AI Authoring Guide

This guide defines how an AI should translate user intent into YSpec.

## Goal

Given a user request, produce the smallest valid YSpec structure that captures the requested behavior without adding unrequested abstractions.

## Core rules

1. Stay in YSpec first.
2. Do not assume a target language unless code generation has started.
3. Prefer the smallest valid document shape.
4. Do not invent modules, classes, types, or macros unless the user clearly needs them.
5. Ask for clarification only when missing information changes behavior.
6. If behavior can be safely normalized by convention, normalize it instead of asking.

## Document-shape selection

Choose the top-level shape from the user’s intent.

- Use `function` for a single callable behavior.
- Use `module` when the user describes exports, imports, multiple functions, or a file-level API.
- Use `class` when the user explicitly wants state plus methods as a named object.
- Use `macro` only when the user wants reusable expansion-time templates.

## What not to invent

Do not invent:
- classes for plain grouped functions
- modules for one isolated function unless file/API boundaries matter
- generics unless reuse across types is part of the request
- exceptions if the user only requested a normal conditional fallback
- macros for one-off logic
- type annotations unless requested or clearly useful in the spec context

## Normalization workflow

1. Detect the requested behavior.
2. Choose the smallest valid top-level document shape.
3. Normalize the user’s wording into canonical YSpec statements.
4. Add types, async, exceptions, pattern matching, generics, or macros only if needed.
5. Validate the result against the schema and validation docs.

## Clarification rules

Ask for clarification when any of these would materially change behavior:
- missing return behavior
- unknown fallback behavior on failure
- ambiguous mutation target
- unclear module/class boundary
- unknown data shape where multiple interpretations are equally plausible

Do not ask for clarification when conventions safely resolve the issue.

## Safe conventions

Use these defaults unless the user overrides them:
- one described behavior -> `function`
- repeated iteration over a collection -> `forEach`
- simple branching -> `if`
- explicit failure recovery -> `try` / `except`
- async external call -> `async: true` plus `await`
- first-match structured branching -> `match`

## Output discipline

When generating YSpec:
- keep keys in canonical order
- keep YAML indentation clean
- keep statement blocks explicit
- avoid mixing multiple statement kinds in one mapping
- use consistent names for captured variables in pattern matching

## Canonical order recommendations

### Function
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

### Class
```yaml
class: Name
generics:
  - T
fields:
  - name: value
    type: T
methods:
  - function: getValue
    returns: T
    logic:
      - return: value
```

### Module
```yaml
module: name
imports:
  - from: ./other.yspec
    symbols:
      - helper
exports:
  - main
functions:
  - function: main
    logic:
      - return: helper()
```

## AI authoring checklist

Before finalizing output, verify:
- Is the document shape the smallest one that fits?
- Did I avoid inventing abstractions?
- Is every statement a valid YSpec node?
- Are ambiguity-sensitive parts clarified or safely normalized?
- Does the result match the user’s requested behavior and nothing more?
