# YSpec

**A YAML-structured language that transpiles to JavaScript.**

YSpec combines YAML's clean declarations, JavaScript's familiar expressions, and Python's readable blocks — into one language.

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

Transpiles to:

```javascript
const API_URL = "https://api.example.com";

async function fetchUser(id) {
  const res = await fetch(`${API_URL}/users/${id}`);
  return res.json();
}

const user = await fetchUser("42");
console.log(user.name);
```

## Install

```bash
npm install -g yspec
```

## Quick Start

```bash
# Create a new project
yspec init my-app
cd my-app

# Run it
yspec run main.yspec

# Compile to JavaScript
yspec build main.yspec
```

## Why YSpec?

| Feature | JavaScript | TypeScript | YSpec |
|---------|-----------|------------|-------|
| Curly braces | ✓ | ✓ | ✗ |
| Semicolons | ✓ | ✓ | ✗ |
| Machine-readable structure | ✗ | ✗ | ✓ |
| Type annotations | ✗ | ✓ | ✓ |
| Zero config | ✗ | ✗ | ✓ |

**YSpec's unique advantage:** The YAML structure layer makes your code machine-readable by default. An AI or tool can parse the structure without touching the logic.

## Language Features

### Functions

```yaml
function add:
  inputs:
    - a: number
    - b: number
  returns: number
  logic: |
    return a + b
```

### Classes

```yaml
class Dog:
  fields:
    - name: string
    - breed: string
  methods:
    - function bark:
        logic: |
          console.log(`${this.name} says Woof!`)
```

### Async/Await

```yaml
function fetchData:
  async: true
  logic: |
    const res = await fetch("https://api.example.com/data")
    return res.json()
```

### Imports (npm, node builtins, local)

```yaml
imports:
  - from: express
  - from: node:fs
    symbols: [readFile, writeFile]
  - from: ./utils.yspec
    symbols: [formatDate]
```

### Variables

```yaml
const MAX_RETRIES: 3
let counter: 0
```

### Control Flow

```yaml
logic: |
  if status === "active":
    console.log("Active!")
  elseif status === "pending":
    console.log("Waiting...")
  else:
    console.log("Unknown")

  for item in items:
    console.log(item.name)
```

### Exception Handling

```yaml
logic: |
  try:
    const data = JSON.parse(raw)
  catch SyntaxError as e:
    console.error("Bad JSON:", e.message)
```

## CLI Reference

```
yspec init <name>                Create a new project
yspec run <file.yspec>           Transpile and execute
yspec build <file.yspec>         Compile to .js
yspec generate <file.yspec>      Print generated JS to stdout
yspec validate <file.yspec>      Check for errors
yspec watch <file.yspec> -o out  Watch and regenerate on save
```

## How It Works

```
.yspec file → YAML Parser → AST → Validator → JS Generator → .js file
```

1. **Parse** — YAML structure + logic blocks are parsed into an AST
2. **Validate** — structural rules are checked (required fields, valid patterns)
3. **Generate** — the AST is transpiled to idiomatic JavaScript (ES modules)

## VS Code Extension

Install the `yspec-language` extension for syntax highlighting with distinct colors for keywords, function names, types, and more.

## Documentation

- [Language Specification](./yspec-language-spec.md)
- [Beginner Guide](./yspec-beginner-guide.md)
- [Examples](./yspec-examples.md)
- [Schema Reference](./yspec-schema-reference.md)
- [Validation Rules](./yspec-validation-rules.md)

## License

MIT
