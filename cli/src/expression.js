/**
 * Expression handler for YSpec → JS.
 *
 * For the JS target, most expressions are passthrough since YSpec expressions
 * are already JS-compatible. This module handles structured expressions like
 * `await` and pattern capture variables ($name).
 */

import { ExpressionError } from './errors.js';

/**
 * Check if a value is a structured await expression.
 * { await: { call: '...', args: [...] } }
 */
export function isAwaitExpression(value) {
  return value !== null && typeof value === 'object' && 'await' in value;
}

/**
 * Generate JS for an await expression.
 */
export function generateAwait(awaitNode, scope) {
  const inner = awaitNode.await;
  if (!inner || !inner.call) {
    throw new ExpressionError('await expression must have a call property');
  }

  const callName = inner.call;
  const args = (inner.args || []).map(a => resolveExpression(a, scope));
  return `await ${callName}(${args.join(', ')})`;
}

/**
 * Resolve a pattern capture variable ($name → just the name).
 */
export function resolveCapture(pattern) {
  if (typeof pattern === 'string' && pattern.startsWith('$')) {
    return pattern.slice(1);
  }
  return pattern;
}

/**
 * Check if a value is a pattern capture ($name).
 */
export function isCapture(value) {
  return typeof value === 'string' && value.startsWith('$');
}

/**
 * Check if a value is the wildcard pattern.
 */
export function isWildcard(value) {
  return value === '_';
}

/**
 * Resolve an expression value to JS code.
 * Handles: strings (passthrough), await expressions, and scope resolution.
 */
export function resolveExpression(value, scope) {
  if (value === null || value === undefined) {
    return 'null';
  }

  // Structured await expression
  if (isAwaitExpression(value)) {
    return generateAwait(value, scope);
  }

  // Object literal (not an await) — pass through as JSON-ish
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
      .map(([k, v]) => `${k}: ${resolveExpression(v, scope)}`)
      .join(', ');
    return `{ ${entries} }`;
  }

  // Array
  if (Array.isArray(value)) {
    return `[${value.map(v => resolveExpression(v, scope)).join(', ')}]`;
  }

  // Boolean / number — direct
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  // String expression — passthrough for JS target
  // But resolve known variable names through scope if applicable
  if (typeof value === 'string') {
    if (scope) {
      const trimmed = value.trim();
      // Simple single-identifier — direct resolve
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(trimmed)) {
        return scope.resolve(trimmed);
      }
      // Compound expression — resolve each identifier token through scope
      // Replace word-boundary identifiers that are class fields
      return trimmed.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, (match) => {
        return scope.resolve(match);
      });
    }
    return value;
  }

  return String(value);
}

/**
 * Validate basic expression safety.
 */
export function validateExpression(value) {
  if (value === null || value === undefined) {
    return { valid: false, error: 'Expression is empty' };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { valid: false, error: 'Expression is an empty string' };
    }

    // Check balanced parens
    let depth = 0;
    for (const ch of trimmed) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth < 0) return { valid: false, error: 'Unbalanced parentheses' };
    }
    if (depth !== 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }

  return { valid: true };
}
