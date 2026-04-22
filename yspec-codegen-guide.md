# YSpec Code Generation Guide

This document explains how YSpec should map into target code.

## General principle

Translate valid YSpec into the smallest idiomatic target-code structure that preserves behavior.

## Codegen phases

1. parse YSpec
2. expand macros
3. validate structure
4. resolve imports/exports
5. lower YSpec into an internal AST
6. emit target code
7. format emitted code

## Variable declaration policy

For `set`:
- first assignment may become a declaration
- later assignments become reassignments
- declaration style depends on the target language

## Function lowering

YSpec `function` lowers to a target-language callable unit.
Inputs, returns, async markers, and logic blocks lower according to the target language.

## Module lowering

YSpec `module` lowers to a file/module boundary.
- `imports` become target-language imports
- `exports` become target-language exports/public API declarations

## Class lowering

YSpec `class` may lower to:
- a native class
- a struct plus methods
- an object factory plus functions

Choose the most idiomatic target equivalent.

## Type annotation lowering

Type annotations should map only when the target language supports them.
If the target language is dynamic, they may be omitted or converted to comments/docs depending on the generator policy.

## Exception lowering

- `try` lowers to protected execution blocks
- `except` lowers to typed catch/handler logic where possible
- `raise` lowers to target-language error creation and throw behavior

If the target language lacks typed exceptions, preserve the category through error objects or tagged handling.

## Async lowering

- `async: true` lowers to async/coroutine form
- `await` lowers to target-language await semantics
- `parallel` lowers to concurrency primitives appropriate for the language/runtime

## Pattern matching lowering

Prefer native pattern matching if the target language supports it.
Otherwise lower to ordered branching that preserves first-match semantics.

## Generic lowering

Map `generics` only when the target language supports generics or type parameters.
If not supported, preserve behavior while dropping or simulating type parameters.

## Macro lowering

Macros do not directly lower to code.
They must expand into normal YSpec before code generation.

## Language-neutral constraints

A code generator should not:
- invent new behavior
- add extra abstraction layers not implied by YSpec
- merge unrelated statements for convenience
- discard failure or async semantics

## Minimal codegen checklist

Before emitting code, verify:
- all macros expanded
- all imports resolved
- all blocks valid
- async semantics preserved
- exception flow preserved
- target-language output matches requested behavior
