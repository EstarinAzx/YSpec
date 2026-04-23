/**
 * YSpec error types — maps directly to the validation-rules.md error categories.
 */

export class YSpecError extends Error {
  constructor(category, message, context = {}) {
    super(message);
    this.name = 'YSpecError';
    this.category = category;
    this.context = context;
    this.line = context.line || null;
    this.column = context.column || null;
  }

  /**
   * Format a rich error message with source context.
   * @param {string} [source] - the original source text
   * @returns {string}
   */
  format(source) {
    const parts = [];

    // Error header
    const loc = this.line ? `:${this.line}${this.column ? ':' + this.column : ''}` : '';
    const filePart = this.context.path ? `${this.context.path}${loc}` : '';
    parts.push(`[${this.category}]${filePart ? ' at ' + filePart : ''} ${this.message}`);

    // Source snippet
    if (source && this.line) {
      const lines = source.split('\n');
      const lineIdx = this.line - 1;
      const start = Math.max(0, lineIdx - 1);
      const end = Math.min(lines.length, lineIdx + 2);

      parts.push('');
      for (let i = start; i < end; i++) {
        const num = String(i + 1).padStart(4);
        const marker = i === lineIdx ? ' > ' : '   ';
        parts.push(`${marker}${num} | ${lines[i]}`);
        // Add caret if this is the error line and we have a column
        if (i === lineIdx && this.column) {
          const padding = ' '.repeat(8 + this.column - 1);
          parts.push(`${padding}^`);
        }
      }
    }

    return parts.join('\n');
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
