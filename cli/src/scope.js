/**
 * Variable scope tracker.
 *
 * Tracks which variables have been declared (first `set`) vs reassigned
 * (subsequent `set`). Handles nested scopes for blocks and class context
 * for field resolution.
 */

export class Scope {
  /**
   * @param {Scope|null} parent - parent scope for nesting
   * @param {'function'|'class'|'block'} kind - what created this scope
   * @param {string[]} params - pre-declared parameter names
   * @param {string[]} fields - class field names (only for class scope)
   */
  constructor(parent = null, kind = 'function', params = [], fields = []) {
    this.parent = parent;
    this.kind = kind;
    this.declared = new Set(params);
    this.fields = new Set(fields);
  }

  /**
   * Check if a variable has been declared in this scope or any parent.
   */
  isDeclared(name) {
    if (this.declared.has(name)) return true;
    if (this.parent) return this.parent.isDeclared(name);
    return false;
  }

  /**
   * Check if a name is a class field (needs `this.` prefix).
   */
  isField(name) {
    if (this.fields.has(name)) return true;
    if (this.parent) return this.parent.isField(name);
    return false;
  }

  /**
   * Declare a variable. Returns true if this is a NEW declaration,
   * false if it was already declared (reassignment).
   */
  declare(name) {
    if (this.isDeclared(name)) {
      return false; // reassignment
    }
    this.declared.add(name);
    return true; // new declaration
  }

  /**
   * Create a child scope for a nested block.
   */
  child(kind = 'block') {
    return new Scope(this, kind);
  }

  /**
   * Resolve a variable reference — add `this.` prefix if it's a class field
   * and hasn't been shadowed by a local declaration.
   */
  resolve(name) {
    // If declared locally, use as-is
    if (this.declared.has(name)) return name;
    // If it's a class field, prefix with this.
    if (this.isField(name)) return `this.${name}`;
    // Check parent
    if (this.parent) return this.parent.resolve(name);
    // Unknown — pass through as-is
    return name;
  }
}

/**
 * Create a function-level scope with params pre-declared.
 */
export function functionScope(params = [], classFields = []) {
  return new Scope(null, 'function', params, classFields);
}

/**
 * Create a class-level scope with fields tracked.
 */
export function classScope(fields = []) {
  return new Scope(null, 'class', [], fields);
}
