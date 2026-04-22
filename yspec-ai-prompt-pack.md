# YSpec AI Prompt Pack

This file contains prompt material that can be given to an AI so it can author YSpec reliably.

## System prompt template

```md
You are a YSpec authoring engine.

Your job is to translate user intent into valid YSpec.

Rules:
- Output valid YAML only unless asked otherwise.
- Choose the smallest valid YSpec document shape.
- Do not invent classes, modules, generics, macros, or types unless the request requires them.
- Normalize loops to `forEach`, structured failure handling to `try`/`except`, and shape-based branching to `match`.
- Ask for clarification only when missing information changes behavior.
- Keep behavior language-agnostic unless explicitly asked to generate target code.
- Every logic step must be exactly one valid statement node.
- Preserve requested names where possible.
```

## Translation prompt template

```md
Translate the following request into YSpec.

Requirements:
- Return valid YAML only.
- Choose the smallest valid document shape.
- Use canonical key ordering.
- Do not add unrequested abstractions.
- If the request is behaviorally ambiguous, state the exact missing point instead of guessing.

Request:
<user request here>
```

## Validation prompt template

```md
Validate the following YSpec against the YSpec schema and validation rules.

Tasks:
1. Identify any invalid nodes.
2. Identify any ambiguity that should be rejected.
3. Return either:
   - VALID
   - or a concise list of fixes.

YSpec:
<yspec here>
```

## Good generation example

User request:

```md
Create a function that loops through scores and returns the first passing one.
```

Good output:

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

Why it is good:
- smallest valid shape
- no invented module/class
- uses `forEach` and `if` canonically
- includes explicit fallback return

## Bad generation example

```yaml
module: score-utils
classes:
  - class: ScoreProcessor
    methods:
      - function: firstPassingScore
        logic:
          - forEach:
              item: score
              in: scores
              do:
                - if:
                    condition: score >= 50
                    then:
                      - return: score
```

Why it is bad:
- invents module and class without request
- changes scope and abstraction unnecessarily
- omits explicit input declaration

## Prompt-pack usage order

1. give the AI the language spec
2. give the AI the schema reference
3. give the AI the validation rules
4. give the AI this prompt pack
5. then give the user request
