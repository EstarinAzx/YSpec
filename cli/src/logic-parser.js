/**
 * YSpec v2 Logic Parser — indentation-based parser for `logic: |` blocks.
 *
 * Parses raw text from YAML literal blocks into the same AST nodes
 * that the v1 YAML list parser produces, ensuring generator compatibility.
 *
 * Uses Python-style indentation to determine block structure.
 */

/**
 * Parse a logic block string (from `logic: |`) into AST nodes.
 *
 * @param {string} text - raw logic block text
 * @returns {object[]} array of statement AST nodes
 */
export function parseLogicText(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = tokenizeLines(text);
  if (lines.length === 0) return [];

  return parseBlock(lines, 0, lines.length, 0);
}

// ─── Line Tokenizer ────────────────────────────────────────────────

/**
 * Split raw text into line tokens with indent levels.
 * Strips empty lines and comments.
 */
function tokenizeLines(text) {
  const rawLines = text.split('\n');
  const tokens = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    // Skip completely empty lines
    if (raw.trim() === '') continue;

    // Calculate indent (number of leading spaces)
    const indent = raw.length - raw.trimStart().length;
    const content = raw.trim();

    // Skip comment-only lines
    if (content.startsWith('#')) {
      tokens.push({ line: i + 1, indent, content, type: 'comment', text: content.slice(1).trim() });
      continue;
    }

    tokens.push({ line: i + 1, indent, content });
  }

  return tokens;
}

// ─── Block Parser ──────────────────────────────────────────────────

/**
 * Parse a contiguous block of lines at a given indent level.
 * Returns AST statement nodes.
 */
function parseBlock(lines, start, end, baseIndent) {
  const stmts = [];
  let i = start;

  while (i < end) {
    const token = lines[i];

    // Skip lines below our indent level (shouldn't happen in well-formed input)
    if (token.indent < baseIndent) break;

    // Comment
    if (token.type === 'comment') {
      stmts.push({ type: 'comment', text: token.text });
      i++;
      continue;
    }

    const content = token.content;

    // ─── const/let declaration ───
    const assignMatch = content.match(/^(const|let)\s+(.+)$/);
    if (assignMatch) {
      const keyword = assignMatch[1];
      const rest = assignMatch[2];
      const stmt = parseAssignment(rest, keyword === 'const');
      if (stmt) {
        stmts.push(stmt);
        i++;
        continue;
      }
    }

    // ─── reassignment (x = expr, this.x = expr) ───
    const reassignMatch = content.match(/^([a-zA-Z_$][a-zA-Z0-9_$.*[\]]*)\s*=\s*(.+)$/);
    if (reassignMatch && !content.startsWith('if ') && !content.startsWith('while ')
        && !content.startsWith('for ') && !content.match(/^(const|let)\s/)) {
      stmts.push({
        type: 'set',
        const: false,
        assignments: [{ name: reassignMatch[1], value: reassignMatch[2] }]
      });
      i++;
      continue;
    }

    // ─── if / elseif / else ───
    if (content.match(/^if\s+.+:$/)) {
      const result = parseIfChain(lines, i, end, token.indent);
      stmts.push(result.stmt);
      i = result.nextIndex;
      continue;
    }

    // ─── while ───
    const whileMatch = content.match(/^while\s+(.+):$/);
    if (whileMatch) {
      const body = collectBlock(lines, i + 1, end, token.indent);
      stmts.push({
        type: 'while',
        condition: whileMatch[1],
        do: parseBlock(lines, i + 1, body.end, body.indent)
      });
      i = body.end;
      continue;
    }

    // ─── for item in collection ───
    const forInMatch = content.match(/^for\s+(\w+)\s+in\s+(.+):$/);
    if (forInMatch) {
      const body = collectBlock(lines, i + 1, end, token.indent);
      stmts.push({
        type: 'forEach',
        item: forInMatch[1],
        in: forInMatch[2],
        do: parseBlock(lines, i + 1, body.end, body.indent)
      });
      i = body.end;
      continue;
    }

    // ─── for var from start to end ───
    const forRangeMatch = content.match(/^for\s+(\w+)\s+from\s+(.+)\s+to\s+(.+):$/);
    if (forRangeMatch) {
      const body = collectBlock(lines, i + 1, end, token.indent);
      stmts.push({
        type: 'for',
        var: forRangeMatch[1],
        from: forRangeMatch[2],
        to: forRangeMatch[3],
        step: 1,
        do: parseBlock(lines, i + 1, body.end, body.indent)
      });
      i = body.end;
      continue;
    }

    // ─── return ───
    const returnMatch = content.match(/^return\s*(.*)$/);
    if (returnMatch) {
      stmts.push({ type: 'return', value: returnMatch[1] || undefined });
      i++;
      continue;
    }

    // ─── raise Type(msg) ───
    const raiseMatch = content.match(/^raise\s+(\w+)\((.*)\)$/);
    if (raiseMatch) {
      stmts.push({
        type: 'raise',
        errorType: raiseMatch[1],
        message: raiseMatch[2] || null,
        cause: null
      });
      i++;
      continue;
    }

    // ─── try / catch ───
    if (content === 'try:') {
      const result = parseTryBlock(lines, i, end, token.indent);
      stmts.push(result.stmt);
      i = result.nextIndex;
      continue;
    }

    // ─── await expression as statement ───
    if (content.startsWith('await ')) {
      stmts.push({
        type: 'expression',
        value: content
      });
      i++;
      continue;
    }

    // ─── function call (name.space.fn(args)) ───
    const callMatch = content.match(/^([a-zA-Z_$][a-zA-Z0-9_$.*]*)\s*\((.*)$/);
    if (callMatch) {
      // Collect the full call (might be multi-line)
      let fullExpr = content;
      const openCount = countChar(fullExpr, '(') - countChar(fullExpr, ')');
      let j = i + 1;
      if (openCount > 0) {
        // Multi-line expression — collect until brackets balance
        while (j < end && (countChar(fullExpr, '(') > countChar(fullExpr, ')'))) {
          fullExpr += '\n' + lines[j].content;
          j++;
        }
      }
      stmts.push({
        type: 'expression',
        value: fullExpr
      });
      i = j;
      continue;
    }

    // ─── destructure: const { a, b } = expr  or  const [a, b] = expr ───
    // Already handled by the const assignment parser above via parseAssignment

    // ─── fallback: expression passthrough ───
    stmts.push({ type: 'expression', value: content });
    i++;
  }

  return stmts;
}

// ─── Specialized Parsers ───────────────────────────────────────────

/**
 * Parse a const/let assignment. Handles destructuring too.
 */
function parseAssignment(rest, isConst) {
  // Object destructuring: { a, b, c } = expr
  const objDestructMatch = rest.match(/^\{\s*(.+?)\s*\}\s*=\s*(.+)$/);
  if (objDestructMatch) {
    const names = objDestructMatch[1].split(',').map(s => s.trim());
    return {
      type: 'destructure',
      from: objDestructMatch[2],
      pick: names,
      items: null,
      const: isConst
    };
  }

  // Array destructuring: [a, b, c] = expr
  const arrDestructMatch = rest.match(/^\[\s*(.+?)\s*\]\s*=\s*(.+)$/);
  if (arrDestructMatch) {
    const names = arrDestructMatch[1].split(',').map(s => s.trim());
    return {
      type: 'destructure',
      from: arrDestructMatch[2],
      items: names,
      pick: null,
      const: isConst
    };
  }

  // Simple assignment: name = expr
  const simpleMatch = rest.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(.+)$/);
  if (simpleMatch) {
    return {
      type: 'set',
      const: isConst,
      assignments: [{ name: simpleMatch[1], value: simpleMatch[2] }]
    };
  }

  // Fallback — couldn't parse, treat as expression
  return null;
}

/**
 * Parse an if/elseif/else chain.
 */
function parseIfChain(lines, start, end, baseIndent) {
  const content = lines[start].content;
  const condMatch = content.match(/^if\s+(.+):$/);
  const condition = condMatch[1];

  const thenBody = collectBlock(lines, start + 1, end, baseIndent);
  const thenStmts = parseBlock(lines, start + 1, thenBody.end, thenBody.indent);

  const elseifBranches = [];
  let elseStmts = [];
  let i = thenBody.end;

  // Look for elseif / else at the same indent level
  while (i < end) {
    const token = lines[i];
    if (token.indent !== baseIndent) break;

    const elseifMatch = token.content.match(/^elseif\s+(.+):$/);
    if (elseifMatch) {
      const branchBody = collectBlock(lines, i + 1, end, baseIndent);
      elseifBranches.push({
        condition: elseifMatch[1],
        then: parseBlock(lines, i + 1, branchBody.end, branchBody.indent)
      });
      i = branchBody.end;
      continue;
    }

    if (token.content === 'else:') {
      const elseBody = collectBlock(lines, i + 1, end, baseIndent);
      elseStmts = parseBlock(lines, i + 1, elseBody.end, elseBody.indent);
      i = elseBody.end;
      break;
    }

    // Not part of the if chain anymore
    break;
  }

  return {
    stmt: {
      type: 'if',
      condition,
      then: thenStmts,
      elseif: elseifBranches,
      else: elseStmts
    },
    nextIndex: i
  };
}

/**
 * Parse a try/catch block.
 */
function parseTryBlock(lines, start, end, baseIndent) {
  // try: body
  const tryBody = collectBlock(lines, start + 1, end, baseIndent);
  const tryStmts = parseBlock(lines, start + 1, tryBody.end, tryBody.indent);

  const except = [];
  let elseStmts = [];
  let finallyStmts = [];
  let i = tryBody.end;

  // Look for catch / else / finally at the same indent level
  while (i < end) {
    const token = lines[i];
    if (token.indent !== baseIndent) break;

    // catch Type as name:
    const catchMatch = token.content.match(/^catch\s+(\w+)(?:\s+as\s+(\w+))?:$/);
    if (catchMatch) {
      const catchBody = collectBlock(lines, i + 1, end, baseIndent);
      except.push({
        errorType: catchMatch[1],
        bindTo: catchMatch[2] || 'error',
        then: parseBlock(lines, i + 1, catchBody.end, catchBody.indent)
      });
      i = catchBody.end;
      continue;
    }

    if (token.content === 'finally:') {
      const finallyBody = collectBlock(lines, i + 1, end, baseIndent);
      finallyStmts = parseBlock(lines, i + 1, finallyBody.end, finallyBody.indent);
      i = finallyBody.end;
      break;
    }

    break;
  }

  return {
    stmt: {
      type: 'try',
      do: tryStmts,
      except,
      else: elseStmts,
      finally: finallyStmts
    },
    nextIndex: i
  };
}

// ─── Utilities ─────────────────────────────────────────────────────

/**
 * Collect the index range and indent of a block following a `:` line.
 * A block is all consecutive lines with indent > baseIndent.
 */
function collectBlock(lines, start, end, baseIndent) {
  if (start >= end) return { indent: baseIndent + 2, end: start };

  // First line of the block determines the block's indent level
  const blockIndent = lines[start].indent;

  let i = start;
  while (i < end) {
    const token = lines[i];
    // A line at or below the base indent ends the block
    // (unless it's an elseif/else/catch/finally continuation)
    if (token.indent <= baseIndent) {
      break;
    }
    i++;
  }

  return { indent: blockIndent, end: i };
}

/**
 * Count occurrences of a character in a string.
 */
function countChar(str, ch) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count++;
  }
  return count;
}
