/**
 * JavaScript Code Generator — AST → JS source code.
 *
 * Translates a validated YSpec AST into idiomatic JavaScript (ES modules).
 */

import { functionScope, classScope } from '../scope.js';
import { resolveExpression, isAwaitExpression, isCapture, isWildcard, resolveCapture } from '../expression.js';

const INDENT = '  ';

/**
 * Generate JavaScript code from a parsed+validated YSpec document.
 *
 * @param {object} doc - parsed document from parser.parse()
 * @returns {string} generated JavaScript source
 */
export function generate(doc) {
  switch (doc.kind) {
    case 'function':
      return generateFunction(doc.ast, 0);
    case 'module':
      return generateModule(doc.ast);
    case 'class':
      return generateClass(doc.ast, 0);
    case 'macro':
      return `// Macro "${doc.ast.name}" — expand before codegen\n` +
        `// Params: ${doc.ast.params.join(', ')}\n`;
    default:
      return `// Unknown document kind: ${doc.kind}\n`;
  }
}

/**
 * Generate a function.
 */
function generateFunction(fn, depth, classFields = [], exportPrefix = '') {
  const ind = INDENT.repeat(depth);
  const params = fn.inputs.map(i => i.name).join(', ');
  const scope = functionScope(fn.inputs.map(i => i.name), classFields);

  const asyncPrefix = fn.async ? 'async ' : '';

  // Build JSDoc if there are types or generics
  let jsdoc = '';
  if (fn.generics.length > 0 || fn.inputs.some(i => i.type) || fn.returns) {
    const lines = [`${ind}/**`];
    for (const g of fn.generics) {
      lines.push(`${ind} * @template ${g}`);
    }
    for (const inp of fn.inputs) {
      if (inp.type) {
        lines.push(`${ind} * @param {${inp.type}} ${inp.name}`);
      }
    }
    if (fn.returns) {
      lines.push(`${ind} * @returns {${fn.returns}}`);
    }
    lines.push(`${ind} */`);
    jsdoc = lines.join('\n') + '\n';
  }

  const body = generateLogicBlock(fn.logic, depth + 1, scope);
  return `${jsdoc}${ind}${exportPrefix}${asyncPrefix}function ${fn.name}(${params}) {\n${body}${ind}}\n`;
}

/**
 * Generate a module (ES module format).
 */
function generateModule(mod) {
  const parts = [];

  // Imports
  for (const imp of mod.imports) {
    // Convert .yspec references to .js for local imports only
    const from = imp.kind === 'local'
      ? imp.from.replace(/\.yspec$/, '.js')
      : imp.from;

    if (imp.defaultAs) {
      // Default import with alias: import express from 'express'
      if (imp.symbols.length > 0) {
        // Default + named: import express, { Router } from 'express'
        parts.push(`import ${imp.defaultAs}, { ${imp.symbols.join(', ')} } from '${from}';`);
      } else {
        parts.push(`import ${imp.defaultAs} from '${from}';`);
      }
    } else if (imp.symbols.length === 0 && imp.kind === 'npm') {
      // Bare npm import with no symbols — default import using package name
      const defaultName = imp.from.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
      parts.push(`import ${defaultName} from '${from}';`);
    } else if (imp.symbols.length > 0) {
      // Named imports: import { x, y } from 'z'
      parts.push(`import { ${imp.symbols.join(', ')} } from '${from}';`);
    } else {
      // Side-effect import: import './setup.js'
      parts.push(`import '${from}';`);
    }
  }

  if (mod.imports.length > 0) {
    parts.push('');
  }

  // Collect export names
  const exportNames = new Set(mod.exports);

  // Variables
  if (mod.variables && mod.variables.length > 0) {
    for (const v of mod.variables) {
      const exportPrefix = exportNames.has(v.name) ? 'export ' : '';
      const keyword = v.const ? 'const' : 'let';
      // Add JSDoc type if specified
      if (v.type) {
        parts.push(`/** @type {${v.type}} */`);
      }
      parts.push(`${exportPrefix}${keyword} ${v.name} = ${formatValue(v.value)};`);
    }
    parts.push('');
  }

  // Classes
  for (const cls of mod.classes) {
    const exportPrefix = exportNames.has(cls.name) ? 'export ' : '';
    parts.push(generateClass(cls, 0, exportPrefix).trimEnd());
    parts.push('');
  }

  // Functions
  for (const fn of mod.functions) {
    const exportPrefix = exportNames.has(fn.name) ? 'export ' : '';
    parts.push(generateFunction(fn, 0, [], exportPrefix).trimEnd());
    parts.push('');
  }

  // Top-level logic (unusual but supported)
  if (mod.logic.length > 0) {
    const scope = functionScope();
    parts.push(generateLogicBlock(mod.logic, 0, scope));
  }

  return parts.join('\n') + '\n';
}

/**
 * Generate a class.
 */
function generateClass(cls, depth, exportPrefix = '') {
  const ind = INDENT.repeat(depth);
  const lines = [];

  // Generics as JSDoc
  if (cls.generics.length > 0) {
    lines.push(`${ind}/**`);
    for (const g of cls.generics) {
      lines.push(`${ind} * @template ${g}`);
    }
    lines.push(`${ind} */`);
  }

  const extendsClause = cls.extends ? ` extends ${cls.extends}` : '';
  lines.push(`${ind}${exportPrefix}class ${cls.name}${extendsClause} {`);

  // Check if there's an explicit constructor in methods
  const hasExplicitConstructor = cls.methods.some(m => m.name === 'constructor');

  // Auto-generate constructor from fields ONLY if no explicit constructor
  if (cls.fields.length > 0 && !hasExplicitConstructor) {
    // Fields without defaults become constructor params
    const paramFields = cls.fields.filter(f => f.default === undefined);
    const defaultFields = cls.fields.filter(f => f.default !== undefined);
    const paramList = paramFields.map(f => f.name).join(', ');

    lines.push(`${ind}${INDENT}constructor(${paramList}) {`);
    // Call super() when extending a parent class
    if (cls.extends) {
      lines.push(`${ind}${INDENT}${INDENT}super(${paramList});`);
    }
    for (const field of paramFields) {
      lines.push(`${ind}${INDENT}${INDENT}this.${field.name} = ${field.name};`);
    }
    for (const field of defaultFields) {
      lines.push(`${ind}${INDENT}${INDENT}this.${field.name} = ${formatValue(field.default)};`);
    }
    lines.push(`${ind}${INDENT}}`);
    lines.push('');
  }

  // Methods
  const fieldNames = cls.fields.map(f => f.name);
  for (const method of cls.methods) {
    const params = method.inputs.map(i => i.name).join(', ');
    const isConstructor = method.name === 'constructor';
    // In constructor, params are inputs but field names should still resolve to this.
    // We create scope with params declared, but fields tracked separately
    const scope = functionScope(method.inputs.map(i => i.name), fieldNames);
    // For constructor: mark it so generateSet knows to use this. for field targets
    scope._isConstructor = isConstructor;
    const asyncPrefix = method.async ? 'async ' : '';

    lines.push(`${ind}${INDENT}${asyncPrefix}${method.name}(${params}) {`);

    // For explicit constructors: inject field defaults not covered by logic
    if (isConstructor && cls.fields.length > 0) {
      // Collect field names that are explicitly assigned in constructor logic
      const assignedFields = new Set();
      for (const stmt of (method.logic || [])) {
        if (stmt.type === 'set' && stmt.assignments) {
          for (const a of stmt.assignments) {
            // Handle both "this.field" and just "field" (which gets resolved to this.field)
            const fieldName = a.name.startsWith('this.') ? a.name.slice(5) : a.name;
            assignedFields.add(fieldName);
          }
        }
      }
      // Inject defaults for unassigned fields
      for (const field of cls.fields) {
        if (!assignedFields.has(field.name) && field.default !== undefined) {
          lines.push(`${ind}${INDENT}${INDENT}this.${field.name} = ${formatValue(field.default)};`);
        }
      }
    }

    lines.push(generateLogicBlock(method.logic, depth + 2, scope));
    lines.push(`${ind}${INDENT}}`);
  }

  lines.push(`${ind}}`);
  return lines.join('\n') + '\n';
}

/**
 * Generate a logic block (list of statements).
 */
function generateLogicBlock(stmts, depth, scope) {
  if (!stmts || stmts.length === 0) return '';

  const lines = [];
  for (const stmt of stmts) {
    lines.push(generateStatement(stmt, depth, scope));
  }
  return lines.join('\n') + '\n';
}

/**
 * Generate a single statement.
 */
function generateStatement(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);

  switch (stmt.type) {
    case 'set':
      return generateSet(stmt, depth, scope);
    case 'if':
      return generateIf(stmt, depth, scope);
    case 'forEach':
      return generateForEach(stmt, depth, scope);
    case 'return':
      return `${ind}return ${resolveExpression(stmt.value, scope)};`;
    case 'call':
      return generateCall(stmt, depth, scope);
    case 'try':
      return generateTry(stmt, depth, scope);
    case 'raise':
      return generateRaise(stmt, depth, scope);
    case 'match':
      return generateMatch(stmt, depth, scope);
    case 'parallel':
      return generateParallel(stmt, depth, scope);
    case 'while':
      return generateWhile(stmt, depth, scope);
    case 'for':
      return generateFor(stmt, depth, scope);
    case 'comment':
      return `${ind}// ${stmt.text}`;
    case 'destructure':
      return generateDestructure(stmt, depth, scope);
    case 'expression':
      return `${ind}${resolveExpression(stmt.value, scope)};`;
    default:
      return `${ind}// Unknown statement type: ${stmt.type}`;
  }
}

/**
 * Generate set (variable assignment / declaration).
 */
function generateSet(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const lines = [];
  const forceConst = stmt.const === true;

  for (const { name, value } of stmt.assignments) {
    const resolved = resolveExpression(value, scope);

    // Dotted property names (creature.age, slot.quantity) — always direct assignment
    if (name.includes('.')) {
      lines.push(`${ind}${name} = ${resolved};`);
    }
    // In constructor: if the name is a field, always use this. regardless of params
    else if (scope._isConstructor && scope.isField(name)) {
      lines.push(`${ind}this.${name} = ${resolved};`);
    }
    // If it's a class field, always assign via this.
    else if (scope.isField(name) && !scope.declared.has(name)) {
      lines.push(`${ind}this.${name} = ${resolved};`);
    } else {
      const isNew = scope.declare(name);
      if (isNew) {
        const keyword = forceConst ? 'const' : 'let';
        lines.push(`${ind}${keyword} ${name} = ${resolved};`);
      } else {
        const target = scope.resolve(name);
        lines.push(`${ind}${target} = ${resolved};`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate if/else.
 */
function generateIf(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const cond = resolveExpression(stmt.condition, scope);

  let code = `${ind}if (${cond}) {\n`;
  code += generateLogicBlock(stmt.then, depth + 1, scope);
  code += `${ind}}`;

  // elseif chains
  if (stmt.elseif && stmt.elseif.length > 0) {
    for (const branch of stmt.elseif) {
      const branchCond = resolveExpression(branch.condition, scope);
      code += ` else if (${branchCond}) {\n`;
      code += generateLogicBlock(branch.then, depth + 1, scope);
      code += `${ind}}`;
    }
  }

  if (stmt.else && stmt.else.length > 0) {
    code += ` else {\n`;
    code += generateLogicBlock(stmt.else, depth + 1, scope);
    code += `${ind}}`;
  }

  return code;
}

/**
 * Generate forEach loop.
 */
function generateForEach(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const childScope = scope.child('block');
  childScope.declare(stmt.item);

  const source = resolveExpression(stmt.in, scope);

  let code = `${ind}for (const ${stmt.item} of ${source}) {\n`;
  code += generateLogicBlock(stmt.do, depth + 1, childScope);
  code += `${ind}}`;
  return code;
}

/**
 * Generate function call.
 */
function generateCall(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const args = stmt.args.map(a => resolveExpression(a, scope)).join(', ');
  return `${ind}${stmt.name}(${args});`;
}

/**
 * Generate try/catch/finally.
 */
function generateTry(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);

  let code = `${ind}try {\n`;
  code += generateLogicBlock(stmt.do, depth + 1, scope);
  code += `${ind}}`;

  if (stmt.except.length > 0) {
    // Use the binding name from the first catch handler (catch Error as err → err)
    const catchVar = stmt.except[0].bindTo || 'error';
    code += ` catch (${catchVar}) {\n`;

    if (stmt.except.length === 1) {
      // Single handler — check type
      const handler = stmt.except[0];
      code += `${ind}${INDENT}if (${catchVar} instanceof ${handler.errorType}) {\n`;
      code += generateLogicBlock(handler.then, depth + 2, scope);
      code += `${ind}${INDENT}} else {\n`;
      code += `${ind}${INDENT}${INDENT}throw ${catchVar};\n`;
      code += `${ind}${INDENT}}\n`;
    } else {
      // Multiple handlers — chained if/else if
      for (let i = 0; i < stmt.except.length; i++) {
        const handler = stmt.except[i];
        const keyword = i === 0 ? 'if' : 'else if';
        code += `${ind}${INDENT}${keyword} (${catchVar} instanceof ${handler.errorType}) {\n`;
        code += generateLogicBlock(handler.then, depth + 2, scope);
        code += `${ind}${INDENT}}`;
        if (i < stmt.except.length - 1) {
          code += ' ';
        }
      }
      code += ` else {\n`;
      code += `${ind}${INDENT}${INDENT}throw ${catchVar};\n`;
      code += `${ind}${INDENT}}\n`;
    }

    code += `${ind}}`;
  }

  // else block (runs if try succeeded — unusual in JS, emit as comment + code after try)
  if (stmt.else && stmt.else.length > 0) {
    code += `\n${ind}// try-else: runs on success\n`;
    code += generateLogicBlock(stmt.else, depth, scope);
  }

  if (stmt.finally && stmt.finally.length > 0) {
    code += ` finally {\n`;
    code += generateLogicBlock(stmt.finally, depth + 1, scope);
    code += `${ind}}`;
  }

  return code;
}

/**
 * Generate raise (throw).
 */
function generateRaise(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const args = [];
  if (stmt.message) args.push(resolveExpression(stmt.message, scope));

  let code = `${ind}throw new ${stmt.errorType}(${args.join(', ')});`;

  if (stmt.cause) {
    // Add cause as option object if present
    code = `${ind}throw new ${stmt.errorType}(${args.join(', ')}${args.length > 0 ? ', ' : ''}{ cause: ${resolveExpression(stmt.cause, scope)} });`;
  }

  return code;
}

/**
 * Generate match (pattern matching → chained if/else).
 */
function generateMatch(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const matchVal = resolveExpression(stmt.value, scope);
  const parts = [];

  for (let i = 0; i < stmt.cases.length; i++) {
    const c = stmt.cases[i];
    const keyword = i === 0 ? 'if' : 'else if';

    // Wildcard _ catch-all
    if (isWildcard(c.pattern)) {
      if (i === 0) {
        // Only case — just emit the body
        parts.push(generateLogicBlock(c.then, depth, scope).trimEnd());
      } else {
        parts.push(` else {\n`);
        parts.push(generateLogicBlock(c.then, depth + 1, scope));
        parts.push(`${ind}}`);
      }
      continue;
    }

    // Object pattern — generate conditions and capture bindings
    if (typeof c.pattern === 'object' && c.pattern !== null) {
      const { conditions, captures } = buildPatternCheck(matchVal, c.pattern);
      const guardClause = c.guard ? ` && (${c.guard})` : '';
      const condStr = conditions.join(' && ') + guardClause;

      // Build a block that declares captures and runs the then body
      let block = '';
      const childScope = scope.child('block');
      for (const cap of captures) {
        childScope.declare(cap.name);
        block += `${ind}${INDENT}let ${cap.name} = ${cap.access};\n`;
      }
      block += generateLogicBlock(c.then, depth + 1, childScope);

      if (i === 0) {
        parts.push(`${ind}${keyword} (${condStr}) {\n${block}${ind}}`);
      } else {
        parts.push(` ${keyword} (${condStr}) {\n${block}${ind}}`);
      }
      continue;
    }

    // Scalar pattern — equality check
    const guardClause = c.guard ? ` && (${c.guard})` : '';
    const condStr = `${matchVal} === ${formatValue(c.pattern)}${guardClause}`;

    if (i === 0) {
      parts.push(`${ind}${keyword} (${condStr}) {\n`);
    } else {
      parts.push(` ${keyword} (${condStr}) {\n`);
    }
    parts.push(generateLogicBlock(c.then, depth + 1, scope));
    parts.push(`${ind}}`);
  }

  return parts.join('');
}

/**
 * Build pattern-matching conditions from an object pattern.
 * Returns { conditions: string[], captures: {name, access}[] }
 */
function buildPatternCheck(target, pattern, path = '') {
  const conditions = [];
  const captures = [];
  const accessor = path ? `${target}${path}` : target;

  for (const [key, value] of Object.entries(pattern)) {
    const propAccess = `${accessor}.${key}`;

    if (isCapture(value)) {
      // $name → capture this value
      const captureName = resolveCapture(value);
      captures.push({ name: captureName, access: propAccess });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object pattern — recurse
      const nested = buildPatternCheck(target, value, `${path}.${key}`);
      conditions.push(...nested.conditions);
      captures.push(...nested.captures);
    } else {
      // Literal match
      conditions.push(`${propAccess} === ${formatValue(value)}`);
    }
  }

  return { conditions, captures };
}

/**
 * Generate parallel (Promise.all).
 */
function generateParallel(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);

  // Each branch becomes an async IIFE
  const branches = stmt.branches.map(branch => {
    let inner = generateLogicBlock(branch, depth + 2, scope);
    return `${ind}${INDENT}async () => {\n${inner}${ind}${INDENT}}`;
  });

  return `${ind}await Promise.all([\n${branches.join(',\n')}\n${ind}].map(fn => fn()));`;
}

/**
 * Generate while loop.
 */
function generateWhile(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const childScope = scope.child('block');
  const cond = resolveExpression(stmt.condition, scope);

  let code = `${ind}while (${cond}) {\n`;
  code += generateLogicBlock(stmt.do, depth + 1, childScope);
  code += `${ind}}`;
  return code;
}

/**
 * Generate counted for loop.
 */
function generateFor(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const childScope = scope.child('block');
  childScope.declare(stmt.var);

  const varName = stmt.var;
  const from = resolveExpression(stmt.from, scope);
  const to = resolveExpression(stmt.to, scope);
  const step = stmt.step;

  let stepExpr;
  if (step === 1) {
    stepExpr = `${varName}++`;
  } else if (step === -1) {
    stepExpr = `${varName}--`;
  } else {
    stepExpr = `${varName} += ${step}`;
  }

  const comparator = step > 0 ? '<' : '>';
  let code = `${ind}for (let ${varName} = ${from}; ${varName} ${comparator} ${to}; ${stepExpr}) {\n`;
  code += generateLogicBlock(stmt.do, depth + 1, childScope);
  code += `${ind}}`;
  return code;
}

/**
 * Generate destructuring assignment.
 */
function generateDestructure(stmt, depth, scope) {
  const ind = INDENT.repeat(depth);
  const keyword = stmt.const ? 'const' : 'let';
  const from = resolveExpression(stmt.from, scope);

  if (stmt.pick) {
    // Object destructuring
    for (const name of stmt.pick) {
      scope.declare(name);
    }
    const names = stmt.pick.join(', ');
    return `${ind}${keyword} { ${names} } = ${from};`;
  }

  if (stmt.items) {
    // Array destructuring
    for (const name of stmt.items) {
      if (name !== '_') scope.declare(name); // _ = skip position
    }
    const names = stmt.items.map(n => n === '_' ? '' : n).join(', ');
    return `${ind}${keyword} [${names}] = ${from};`;
  }

  return `${ind}// Empty destructure`;
}

/**
 * Format a value for JS output.
 */
function formatValue(val) {
  if (typeof val === 'string') {
    // JS expressions pass through raw (arrays, objects, template literals, expressions)
    if (val.startsWith('[') || val.startsWith('{') || val.startsWith('`')
        || val.startsWith('(') || val.startsWith('new ')
        || val === '[]' || val === '{}') {
      return val;
    }
    return `'${val}'`;
  }
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  // Arrays from YAML get serialized to JS
  if (Array.isArray(val)) return JSON.stringify(val);
  return JSON.stringify(val);
}
