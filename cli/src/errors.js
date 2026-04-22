/**
 * YSpec error types — maps directly to the validation-rules.md error categories.
 */

export class YSpecError extends Error {
  constructor(category, message, context = {}) {
    super(message);
    this.name = 'YSpecError';
    this.category = category;
    this.context = context;
  }

  toString() {
    const ctx = this.context.path ? ` at ${this.context.path}` : '';
    return `[${this.category}]${ctx} ${this.message}`;
  }
}

export class TopLevelShapeError extends YSpecError {
  constructor(message, context) {
    super('TopLevelShapeError', message, context);
  }
}

export class MissingRequiredFieldError extends YSpecError {
  constructor(message, context) {
    super('MissingRequiredFieldError', message, context);
  }
}

export class InvalidStatementNodeError extends YSpecError {
  constructor(message, context) {
    super('InvalidStatementNodeError', message, context);
  }
}

export class InvalidBlockError extends YSpecError {
  constructor(message, context) {
    super('InvalidBlockError', message, context);
  }
}

export class InvalidImportError extends YSpecError {
  constructor(message, context) {
    super('InvalidImportError', message, context);
  }
}

export class InvalidPatternError extends YSpecError {
  constructor(message, context) {
    super('InvalidPatternError', message, context);
  }
}

export class InvalidMacroError extends YSpecError {
  constructor(message, context) {
    super('InvalidMacroError', message, context);
  }
}

export class ExpressionError extends YSpecError {
  constructor(message, context) {
    super('ExpressionError', message, context);
  }
}
