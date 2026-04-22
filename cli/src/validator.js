/**
 * YSpec Validator — structural validation against the language spec.
 *
 * Implements every rule from yspec-validation-rules.md.
 */

import {
  TopLevelShapeError,
  MissingRequiredFieldError,
  InvalidStatementNodeError,
  InvalidBlockError,
  InvalidImportError,
  InvalidPatternError,
  InvalidMacroError
} from './errors.js';

/**
 * Validate a parsed YSpec document.
 * Returns an array of errors. Empty array = valid.
 *
 * @param {object} doc - parsed document from parser.parse()
 * @returns {YSpecError[]}
 */
export function validate(doc) {
  const errors = [];

  if (!doc || !doc.ast) {
    errors.push(new TopLevelShapeError('No valid AST found in document'));
    return errors;
  }

  switch (doc.kind) {
    case 'function':
      validateFunction(doc.ast, errors, doc.name);
      break;
    case 'module':
      validateModule(doc.ast, errors, doc.name);
      break;
    case 'class':
      validateClass(doc.ast, errors, doc.name);
      break;
    case 'macro':
      validateMacro(doc.ast, errors, doc.name);
      break;
    default:
      errors.push(new TopLevelShapeError(`Unknown document kind: ${doc.kind}`));
  }

  return errors;
}

/**
 * Validate a function AST node.
 */
function validateFunction(fn, errors, path = '') {
  const fnPath = path ? `${path}.${fn.name}` : fn.name;

  if (!fn.name) {
    errors.push(new MissingRequiredFieldError('Function must have a name', { path: fnPath }));
  }

  if (!fn.logic || fn.logic.length === 0) {
    // logic is required for functions per schema reference
    errors.push(new MissingRequiredFieldError('Function must have a logic block', { path: fnPath }));
  }

  if (fn.logic) {
    validateLogicBlock(fn.logic, errors, `${fnPath}.logic`);
  }

  // Validate inputs
  if (fn.inputs) {
    for (const inp of fn.inputs) {
      if (!inp.name) {
        errors.push(new MissingRequiredFieldError('Input must have a name', { path: `${fnPath}.inputs` }));
      }
    }
  }
}

/**
 * Validate a module AST node.
 */
function validateModule(mod, errors, path = '') {
  const modPath = path || mod.name;

  if (!mod.name) {
    errors.push(new MissingRequiredFieldError('Module must have a name', { path: modPath }));
  }

  // Validate imports
  if (mod.imports) {
    for (const imp of mod.imports) {
      validateImport(imp, errors, `${modPath}.imports`);
    }
  }

  // Validate functions
  if (mod.functions) {
    for (const fn of mod.functions) {
      validateFunction(fn, errors, modPath);
    }
  }

  // Validate classes
  if (mod.classes) {
    for (const cls of mod.classes) {
      validateClass(cls, errors, modPath);
    }
  }

  // Validate macros
  if (mod.macros) {
    for (const mac of mod.macros) {
      validateMacro(mac, errors, modPath);
    }
  }

  // Validate top-level logic
  if (mod.logic && mod.logic.length > 0) {
    validateLogicBlock(mod.logic, errors, `${modPath}.logic`);
  }
}

/**
 * Validate a class AST node.
 */
function validateClass(cls, errors, path = '') {
  const clsPath = path ? `${path}.${cls.name}` : cls.name;

  if (!cls.name) {
    errors.push(new MissingRequiredFieldError('Class must have a name', { path: clsPath }));
  }

  // Validate fields
  if (cls.fields) {
    for (const field of cls.fields) {
      if (!field.name) {
        errors.push(new MissingRequiredFieldError('Field must have a name', { path: `${clsPath}.fields` }));
      }
    }
  }

  // Validate methods
  if (cls.methods) {
    for (const method of cls.methods) {
      validateFunction(method, errors, clsPath);
    }
  }
}

/**
 * Validate a macro AST node.
 */
function validateMacro(mac, errors, path = '') {
  const macPath = path ? `${path}.${mac.name}` : mac.name;

  if (!mac.name) {
    errors.push(new MissingRequiredFieldError('Macro must have a name', { path: macPath }));
  }

  if (!mac.expandsTo || mac.expandsTo.length === 0) {
    errors.push(new InvalidMacroError('Macro must have expandsTo', { path: macPath }));
  }

  if (mac.expandsTo) {
    validateLogicBlock(mac.expandsTo, errors, `${macPath}.expandsTo`);
  }
}

/**
 * Validate an import entry.
 */
function validateImport(imp, errors, path) {
  if (!imp.from) {
    errors.push(new InvalidImportError('Import must have "from"', { path }));
  }
  if (!imp.symbols || imp.symbols.length === 0) {
    errors.push(new InvalidImportError('Import must have "symbols"', { path }));
  }
}

/**
 * Validate a logic block (list of statement nodes).
 */
function validateLogicBlock(block, errors, path) {
  if (!Array.isArray(block)) {
    errors.push(new InvalidBlockError('Logic block must be a list', { path }));
    return;
  }

  for (let i = 0; i < block.length; i++) {
    validateStatement(block[i], errors, `${path}[${i}]`);
  }
}

/**
 * Validate a single statement node.
 */
function validateStatement(stmt, errors, path) {
  if (!stmt) {
    errors.push(new InvalidStatementNodeError('Statement is null/undefined', { path }));
    return;
  }

  if (stmt.type === 'invalid') {
    errors.push(new InvalidStatementNodeError(stmt.error, { path }));
    return;
  }

  switch (stmt.type) {
    case 'set':
      if (!stmt.assignments || stmt.assignments.length === 0) {
        errors.push(new InvalidStatementNodeError('set must contain at least one assignment', { path }));
      }
      break;

    case 'if':
      if (stmt.condition === undefined || stmt.condition === null) {
        errors.push(new MissingRequiredFieldError('if must have a condition', { path }));
      }
      if (!stmt.then || stmt.then.length === 0) {
        errors.push(new MissingRequiredFieldError('if must have a then block', { path }));
      }
      if (stmt.then) validateLogicBlock(stmt.then, errors, `${path}.then`);
      if (stmt.else && stmt.else.length > 0) validateLogicBlock(stmt.else, errors, `${path}.else`);
      break;

    case 'forEach':
      if (!stmt.item) {
        errors.push(new MissingRequiredFieldError('forEach must have an item', { path }));
      }
      if (!stmt.in) {
        errors.push(new MissingRequiredFieldError('forEach must have an "in" source', { path }));
      }
      if (!stmt.do || stmt.do.length === 0) {
        errors.push(new MissingRequiredFieldError('forEach must have a do block', { path }));
      }
      if (stmt.do) validateLogicBlock(stmt.do, errors, `${path}.do`);
      break;

    case 'return':
      // return must have a value (even null is valid as explicit)
      break;

    case 'call':
      if (!stmt.name) {
        errors.push(new MissingRequiredFieldError('call must have a name', { path }));
      }
      if (stmt.args && !Array.isArray(stmt.args)) {
        errors.push(new InvalidStatementNodeError('call args must be a list', { path }));
      }
      break;

    case 'try':
      if (!stmt.do || stmt.do.length === 0) {
        errors.push(new MissingRequiredFieldError('try must have a do block', { path }));
      }
      if (stmt.do) validateLogicBlock(stmt.do, errors, `${path}.do`);
      if (stmt.except) {
        for (let i = 0; i < stmt.except.length; i++) {
          const handler = stmt.except[i];
          if (!handler.errorType) {
            errors.push(new MissingRequiredFieldError('except handler must have a type', { path: `${path}.except[${i}]` }));
          }
          if (!handler.then || handler.then.length === 0) {
            errors.push(new MissingRequiredFieldError('except handler must have a then block', { path: `${path}.except[${i}]` }));
          }
          if (handler.then) validateLogicBlock(handler.then, errors, `${path}.except[${i}].then`);
        }
      }
      if (stmt.else && stmt.else.length > 0) validateLogicBlock(stmt.else, errors, `${path}.else`);
      if (stmt.finally && stmt.finally.length > 0) validateLogicBlock(stmt.finally, errors, `${path}.finally`);
      break;

    case 'raise':
      if (!stmt.errorType) {
        errors.push(new MissingRequiredFieldError('raise must have a type', { path }));
      }
      break;

    case 'match':
      if (stmt.value === undefined || stmt.value === null) {
        errors.push(new MissingRequiredFieldError('match must have a value', { path }));
      }
      if (!stmt.cases || stmt.cases.length === 0) {
        errors.push(new MissingRequiredFieldError('match must have cases', { path }));
      }
      if (stmt.cases) {
        for (let i = 0; i < stmt.cases.length; i++) {
          const c = stmt.cases[i];
          if (c.pattern === undefined) {
            errors.push(new InvalidPatternError('case must have a pattern', { path: `${path}.cases[${i}]` }));
          }
          if (!c.then || c.then.length === 0) {
            errors.push(new MissingRequiredFieldError('case must have a then block', { path: `${path}.cases[${i}]` }));
          }
          if (c.then) validateLogicBlock(c.then, errors, `${path}.cases[${i}].then`);
        }
      }
      break;

    case 'parallel':
      if (!stmt.branches || stmt.branches.length === 0) {
        errors.push(new MissingRequiredFieldError('parallel must have branches', { path }));
      }
      if (stmt.branches) {
        for (let i = 0; i < stmt.branches.length; i++) {
          validateLogicBlock(stmt.branches[i], errors, `${path}.branches[${i}]`);
        }
      }
      break;

    case 'expression':
      // Passthrough expressions — valid
      break;

    default:
      errors.push(new InvalidStatementNodeError(`Unknown statement type: ${stmt.type}`, { path }));
  }
}
