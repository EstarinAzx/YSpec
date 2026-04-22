# YSpec Beginner Guide

## What is YSpec?

YSpec is a YAML-based way to describe program logic in a clean and structured format.

Instead of writing code directly, you describe:
- what the program unit is
- what inputs it takes
- what logic it follows
- what it returns or exports

Then YSpec can be translated into real code.

---

## Why YSpec exists

Normal natural language is easy to say, but messy for programming.

Example:

> make a function that loops through scores and returns the average of the ones above 50

That makes sense to a human, but it is not structured enough to safely turn into code every time.

YSpec solves that by turning logic into a readable structure.

---

## Basic shape of YSpec

A simple YSpec function looks like this:

```yaml
function: add
inputs:
  - a
  - b
logic:
  - return: a + b
```

This becomes:

```js
function add(a, b) {
  return a + b;
}
```

---

## Main parts

### `function`
The name of the function.

```yaml
function: add
```

### `inputs`
The values the function receives.

```yaml
inputs:
  - a
  - b
```

### `logic`
The steps the function performs.

```yaml
logic:
  - return: a + b
```

---

## Statements you can use

### Set a variable

```yaml
- set:
    total: 0
```

Meaning:

```js
let total = 0;
```

### Return a value

```yaml
- return: total
```

Meaning:

```js
return total;
```

### If statement

```yaml
- if:
    condition: score >= 50
    then:
      - return: true
```

Meaning:

```js
if (score >= 50) {
  return true;
}
```

### If / else

```yaml
- if:
    condition: age >= 18
    then:
      - return: true
    else:
      - return: false
```

Meaning:

```js
if (age >= 18) {
  return true;
} else {
  return false;
}
```

### Loop through a list

```yaml
- forEach:
    item: score
    in: scores
    do:
      - set:
          total: total + score
```

Meaning:

```js
for (const score of scores) {
  total = total + score;
}
```

### Call a function

```yaml
- call:
    name: logScore
    args:
      - score
```

Meaning:

```js
logScore(score);
```

---

## Full example

```yaml
function: getAveragePassingScore
inputs:
  - scores
logic:
  - set:
      total: 0

  - set:
      count: 0

  - forEach:
      item: score
      in: scores
      do:
        - if:
            condition: score >= 50
            then:
              - set:
                  total: total + score
              - set:
                  count: count + 1

  - if:
      condition: count == 0
      then:
        - return: 0

  - return: total / count
```

This becomes:

```js
function getAveragePassingScore(scores) {
  let total = 0;
  let count = 0;

  for (const score of scores) {
    if (score >= 50) {
      total = total + score;
      count = count + 1;
    }
  }

  if (count == 0) {
    return 0;
  }

  return total / count;
}
```

---

## Type annotations

YSpec can describe types without forcing you to write full code syntax.

```yaml
function: add
inputs:
  - name: a
    type: number
  - name: b
    type: number
returns: number
logic:
  - return: a + b
```

This means the function expects two numbers and returns a number.

---

## Classes

YSpec can describe a class as a structured object with fields and methods.

```yaml
class: Counter
fields:
  - name: count
    type: number
    default: 0
methods:
  - function: increment
    logic:
      - set:
          count: count + 1
      - return: count
```

Think of this as a class blueprint.

---

## Modules and imports

A YSpec file can act like a module.

```yaml
module: math
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

Another module can import from it.

```yaml
module: app
imports:
  - from: ./math.yspec
    symbols:
      - add
logic:
  - return: add(1, 2)
```

This keeps dependencies explicit.

---

## Exceptions

YSpec can show failure handling in a structured way.

```yaml
function: parseCount
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
```

This means: try to parse the value, and if that specific error happens, use a fallback.

---

## Async behavior

YSpec can describe async logic without making the syntax noisy.

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

This means the function pauses until the async call finishes.

---

## Pattern matching

YSpec can match shapes of data, not just simple conditions.

```yaml
function: describeResult
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
            - return: unknown
```

This means the first matching shape wins.

---

## Generics

YSpec can describe reusable structures with placeholders.

```yaml
function: first
generics:
  - T
inputs:
  - name: items
    type: list<T>
returns: T
logic:
  - return: items[0]
```

`T` means the function works with many possible item types.

---

## Macros

YSpec macros are expansion-time helpers.
They let you write a reusable pattern once and expand it into normal YSpec later.

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

Think of a macro as a code template for YSpec itself.

---

## Why this is useful

YSpec is:
- more structured than plain English
- easier to read than JSON
- simpler than real code
- good for converting ideas into code safely
- flexible enough to describe bigger program shapes

---

## Simple rules

1. Use YAML indentation carefully
2. Keep each statement as one clear step
3. Use explicit imports instead of hidden globals
4. Add types when they help clarity
5. Use async, exceptions, and pattern matching only when the logic needs them

---

## Good use cases

YSpec is good for:
- describing functions
- describing loops and conditionals
- describing modules and classes
- expressing logic before generating code
- showing async or error-handling behavior in a readable form

YSpec is not meant to replace all programming languages.
It is a high-level logic format that can be turned into code.

---

## Summary

YSpec is a readable, structured way to describe logic.

Flow:

```txt
Natural language -> YSpec -> real code
```
