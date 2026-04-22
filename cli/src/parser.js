/**
 * YSpec Parser — YAML → internal AST.
 *
 * Parses a .yspec file (YAML) and produces a structured AST with
 * document kind detection, statement node typing, and macro collection.
 */

import yaml from 'js-yaml';
import {
  TopLevelShapeError,
  MissingRequiredFieldError,
  InvalidMacroError
} from './errors.js';

/** Recognized top-level document kinds */
const TOP_LEVEL_KINDS = ['function', 'module', 'class', 'macro'];

/** Recognized statement kinds */
const STATEMENT_KINDS = [
  'set', 'if', 'forEach', 'return', 'call', 'try', 'raise', 'match', 'parallel'
];

/**
 * Parse a YAML string into a YSpec AST document.
 *
 * @param {string} source - raw YAML content
 * @param {string} [filename] - optional filename for error messages
 * @returns {object} parsed AST document
 */
export function parse(source, filename = '<input>') {
  let raw;
  try {
    raw = yaml.load(source);
  } catch (e) {
    throw new TopLevelShapeError(`YAML parse error: ${e.message}`, { path: filename });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TopLevelShapeError('Document must be a YAML mapping', { path: filename });
  }

  // Detect document kind
  const kinds = TOP_LEVEL_KINDS.filter(k => k in raw);

  if (kinds.length === 0) {
    throw new TopLevelShapeError(
      `No top-level document kind found. Must be one of: ${TOP_LEVEL_KINDS.join(', ')}`,
      { path: filename }
    );
  }

  if (kinds.length > 1) {
    throw new TopLevelShapeError(
      `Multiple top-level kinds found: ${kinds.join(', ')}. Only one allowed.`,
      { path: filename }
    );
  }

  const kind = kinds[0];
  const doc = { kind, name: raw[kind], raw, filename };

  switch (kind) {
    case 'function':
      doc.ast = parseFunctionDoc(raw);
      break;
    case 'module':
      doc.ast = parseModuleDoc(raw);
      break;
    case 'class':
      doc.ast = parseClassDoc(raw);
      break;
    case 'macro':
      doc.ast = parseMacroDoc(raw);
      break;
  }

  return doc;
}

/**
 * Parse a function document.
 */
function parseFunctionDoc(raw) {
  return {
    type: 'function',
    name: raw.function,
    async: raw.async || false,
    generics: raw.generics || [],
    inputs: parseInputs(raw.inputs || []),
    returns: raw.returns || null,
    logic: parseLogicBlock(raw.logic || [])
  };
}

/**
 * Parse a module document.
 */
function parseModuleDoc(raw) {
  return {
    type: 'module',
    name: raw.module,
    imports: (raw.imports || []).map(parseImport),
    exports: raw.exports || [],
    functions: (raw.functions || []).map(fn => parseFunctionDoc(fn)),
    classes: (raw.classes || []).map(cls => parseClassDoc(cls)),
    macros: (raw.macros || []).map(m => parseMacroDoc(m)),
    logic: parseLogicBlock(raw.logic || [])
  };
}

/**
 * Parse a class document.
 */
function parseClassDoc(raw) {
  return {
    type: 'class',
    name: raw.class,
    generics: raw.generics || [],
    extends: raw.extends || null,
    implements: raw.implements || [],
    fields: (raw.fields || []).map(parseField),
    methods: (raw.methods || []).map(fn => parseFunctionDoc(fn))
  };
}

/**
 * Parse a macro document.
 */
function parseMacroDoc(raw) {
  if (!raw.expandsTo) {
    throw new MissingRequiredFieldError('Macro must have expandsTo', { path: raw.macro });
  }
  return {
    type: 'macro',
    name: raw.macro,
    params: raw.params || [],
    expandsTo: parseLogicBlock(raw.expandsTo)
  };
}

/**
 * Parse an imports entry.
 */
function parseImport(imp) {
  return {
    from: imp.from,
    symbols: imp.symbols || []
  };
}

/**
 * Parse inputs — supports both shorthand (string) and full form (object with name/type).
 */
function parseInputs(inputs) {
  return inputs.map(inp => {
    if (typeof inp === 'string') {
      return { name: inp, type: null };
    }
    return { name: inp.name, type: inp.type || null };
  });
}

/**
 * Parse a field definition.
 */
function parseField(field) {
  return {
    name: field.name,
    type: field.type || null,
    default: field.default !== undefined ? field.default : undefined
  };
}

/**
 * Parse a logic block (list of statement nodes).
 */
export function parseLogicBlock(block) {
  if (!Array.isArray(block)) {
    return [];
  }
  return block.map(parseStatement);
}

/**
 * Parse a single statement node.
 * Each statement node must have exactly one statement kind key.
 */
function parseStatement(node) {
  if (node === null || node === undefined || typeof node !== 'object') {
    // Possible shorthand — e.g. `- return: value` is parsed as { return: 'value' }
    return { type: 'expression', value: node };
  }

  const keys = Object.keys(node);
  const stmtKinds = keys.filter(k => STATEMENT_KINDS.includes(k));

  if (stmtKinds.length === 0) {
    // Could be an inline expression or unknown — wrap as expression
    return { type: 'expression', value: node };
  }

  if (stmtKinds.length > 1) {
    // Invalid: multiple statement kinds in one node
    return {
      type: 'invalid',
      error: `Multiple statement kinds in one node: ${stmtKinds.join(', ')}`,
      raw: node
    };
  }

  const kind = stmtKinds[0];
  const value = node[kind];

  switch (kind) {
    case 'set':
      return parseSet(value);
    case 'if':
      return parseIf(value);
    case 'forEach':
      return parseForEach(value);
    case 'return':
      return { type: 'return', value };
    case 'call':
      return parseCall(value);
    case 'try':
      return parseTry(value);
    case 'raise':
      return parseRaise(value);
    case 'match':
      return parseMatch(value);
    case 'parallel':
      return parseParallel(value);
    default:
      return { type: 'unknown', kind, value };
  }
}

function parseSet(value) {
  if (typeof value !== 'object' || value === null) {
    return { type: 'set', assignments: [] };
  }
  const assignments = Object.entries(value).map(([name, expr]) => ({
    name,
    value: expr
  }));
  return { type: 'set', assignments };
}

function parseIf(value) {
  return {
    type: 'if',
    condition: value.condition,
    then: parseLogicBlock(value.then || []),
    else: parseLogicBlock(value.else || [])
  };
}

function parseForEach(value) {
  return {
    type: 'forEach',
    item: value.item,
    in: value.in,
    do: parseLogicBlock(value.do || [])
  };
}

function parseCall(value) {
  if (typeof value === 'string') {
    return { type: 'call', name: value, args: [] };
  }
  return {
    type: 'call',
    name: value.name,
    args: value.args || []
  };
}

function parseTry(value) {
  return {
    type: 'try',
    do: parseLogicBlock(value.do || []),
    except: (value.except || []).map(handler => ({
      errorType: handler.type,
      then: parseLogicBlock(handler.then || [])
    })),
    else: parseLogicBlock(value.else || []),
    finally: parseLogicBlock(value.finally || [])
  };
}

function parseRaise(value) {
  return {
    type: 'raise',
    errorType: value.type,
    message: value.message || null,
    cause: value.cause || null
  };
}

function parseMatch(value) {
  return {
    type: 'match',
    value: value.value,
    cases: (value.cases || []).map(c => ({
      pattern: c.case,
      guard: c.if || null,
      then: parseLogicBlock(c.then || [])
    }))
  };
}

function parseParallel(value) {
  return {
    type: 'parallel',
    branches: (value.branches || []).map(branch => parseLogicBlock(branch))
  };
}
