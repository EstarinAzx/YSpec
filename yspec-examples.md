# YSpec Examples

This file collects practical YSpec examples across the core language and the advanced feature set.

---

## 1. Basic function

```yaml
function: add
inputs:
  - a
  - b
logic:
  - return: a + b
```

---

## 2. Typed function

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

---

## 3. Loop and condition

```yaml
function: sumPositiveNumbers
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
  - return: total
```

---

## 4. Module with exports

```yaml
module: math
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
      - return: a - b
```

---

## 5. Imports

```yaml
module: app
imports:
  - from: ./math.yspec
    symbols:
      - add
logic:
  - return: add(1, 2)
```

---

## 6. Class with method

```yaml
class: Counter
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
      - return: count
```

---

## 7. Exception handling

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
      finally:
        - call:
            name: auditParse
            args:
              - value
```

---

## 8. Async function with await

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

---

## 9. Parallel async work

```yaml
function: loadDashboard
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
  - return: { user: user, notifications: notifications }
```

---

## 10. Pattern matching

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

---

## 11. Generic function

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

---

## 12. Generic class

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

---

## 13. Macro

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

## 14. Combined advanced example

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
