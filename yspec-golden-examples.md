# YSpec Golden Examples

Each example shows user intent, normalized YSpec, and reasoning.

---

## 1. Straightforward function

### User intent

```md
Create a function called add that takes a and b and returns their sum.
```

### Normalized YSpec

```yaml
function: add
inputs:
  - a
  - b
logic:
  - return: a + b
```

### Why this shape
- single callable behavior
- no need for module or class
- direct expression return

---

## 2. Iteration and fallback

### User intent

```md
Loop through scores and return the first passing score. If none pass, return null.
```

### Normalized YSpec

```yaml
function: firstPassingScore
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
  - return: null
```

### Why this shape
- iteration clearly maps to `forEach`
- simple branch maps to `if`
- explicit fallback return is preserved

---

## 3. Async external fetch

### User intent

```md
Fetch a user by id and return it.
```

### Normalized YSpec

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

### Why this shape
- external fetch implies async waiting behavior
- still only one function, so no module/class added

---

## 4. Failure recovery

### User intent

```md
Try to parse the count and return 0 if parsing fails.
```

### Normalized YSpec

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

### Why this shape
- user described failure semantics, not just a boolean condition
- `try` / `except` preserves that meaning

---

## 5. Ambiguous class vs module case

### User intent

```md
Make a user manager with methods to add and remove users.
```

### Why this is ambiguous
This could mean:
- a `class` with state and methods
- a `module` containing user-management functions

### Correct AI behavior
Do not guess. Ask whether the user wants shared state in an object/class or just grouped functions.
