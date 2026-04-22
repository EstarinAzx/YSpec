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
    const symbols = imp.symbols.join(', ');
    // Convert .yspec references to .js
    const from = imp.from.replace(/\.yspec$/, '.js');
    parts.push(`import { ${symbols} } from '${from}';`);
  }

  if (mod.imports.length > 0) {
    parts.push('');
  }

  // Collect export names
  const exportNames = new Set(mod.exports);

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

  // Constructor from fields
  if (cls.fields.length > 0) {
    lines.push(`${ind}${INDENT}constructor() {`);
    for (const field of cls.fields) {
      const val = field.default !== undefined ? ` ${formatValue(field.default)}` : ' undefined';
      lines.push(`${ind}${INDENT}${INDENT}this.${field.name} =${val};`);
    }
    lines.push(`${ind}${INDENT}}`);
    lines.push('');
  }

  // Methods
  const fieldNames = cls.fields.map(f => f.name);
  for (const method of cls.methods) {
    const params = method.inputs.map(i => i.name).join(', ');
    const scope = functionScope(method.inputs.map(i => i.name), fieldNames);
    const asyncPrefix = method.async ? 'async ' : '';

    lines.push(`${ind}${INDENT}${asyncPrefix}${method.name}(${params}) {`);
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

  for (const { name, value } of stmt.assignments) {
    const resolved = resolveExpression(value, scope);

    // If it's a class field, always assign via this.
    if (scope.isField(name) && !scope.declared.has(name)) {
      lines.push(`${ind}this.${name} = ${resolved};`);
    } else {
      const isNew = scope.declare(name);
      if (isNew) {
        lines.push(`${ind}let ${name} = ${resolved};`);
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
    code += ` catch (error) {\n`;

    if (stmt.except.length === 1) {
      // Single handler — check type
      const handler = stmt.except[0];
      code += `${ind}${INDENT}if (error instanceof ${handler.errorType}) {\n`;
      code += generateLogicBlock(handler.then, depth + 2, scope);
      code += `${ind}${INDENT}} else {\n`;
      code += `${ind}${INDENT}${INDENT}throw error;\n`;
      code += `${ind}${INDENT}}\n`;
    } else {
      // Multiple handlers — chained if/else if
      for (let i = 0; i < stmt.except.length; i++) {
        const handler = stmt.except[i];
        const keyword = i === 0 ? 'if' : 'else if';
        code += `${ind}${INDENT}${keyword} (error instanceof ${handler.errorType}) {\n`;
        code += generateLogicBlock(handler.then, depth + 2, scope);
        code += `${ind}${INDENT}}`;
        if (i < stmt.except.length - 1) {
          code += ' ';
        }
      }
      code += ` else {\n`;
      code += `${ind}${INDENT}${INDENT}throw error;\n`;
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
 * Format a value for JS output.
 */
function formatValue(val) {
  if (typeof val === 'string') return `'${val}'`;
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  return JSON.stringify(val);
}
