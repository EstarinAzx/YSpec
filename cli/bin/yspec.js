#!/usr/bin/env node

/**
 * YSpec CLI — validate, generate, run, and build .yspec files.
 *
 * Usage:
 *   yspec run <file.yspec>               Transpile and execute
 *   yspec build <file.yspec>             Compile to .js file
 *   yspec generate <file.yspec>          Generate JavaScript to stdout
 *   yspec validate <file.yspec>          Check if a file is valid YSpec
 *   yspec watch <file.yspec> -o out      Regenerate on save
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';
import { generate } from '../src/generators/javascript.js';

// ── Colors for terminal output ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(color, text) {
  return `${color}${text}${c.reset}`;
}

// ── CLI argument parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];
const inputFile = args[1];

// Parse flags
const flags = {};
for (let i = 2; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--output') {
    flags.output = args[++i];
  }
  if (args[i] === '--lang') {
    flags.lang = args[++i];
  }
}

// ── Help ────────────────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
${colorize(c.bold + c.cyan, 'YSpec CLI')} ${colorize(c.dim, 'v0.1.0')}

${colorize(c.bold, 'Usage:')}
  yspec run <file.yspec>                   Transpile and execute
  yspec build <file.yspec>                 Compile to .js file
  yspec generate <file.yspec>              Generate JS to stdout
  yspec generate <file.yspec> -o <out.js>  Generate JS to file
  yspec validate <file.yspec>              Validate a YSpec file
  yspec watch <file.yspec> -o <out.js>     Watch & regenerate on save

${colorize(c.bold, 'Options:')}
  -o, --output <file>    Output file path
  --help                 Show this help
`);
}

if (!command || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

if (!inputFile) {
  console.error(colorize(c.red, 'Error: No input file specified.'));
  showHelp();
  process.exit(1);
}

// ── Resolve input path ──────────────────────────────────────────────────────
const resolvedPath = path.resolve(inputFile);

if (!fs.existsSync(resolvedPath)) {
  console.error(colorize(c.red, `Error: File not found: ${resolvedPath}`));
  process.exit(1);
}

// ── Core pipeline ───────────────────────────────────────────────────────────
function runPipeline(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);

  // Parse
  let doc;
  try {
    doc = parse(source, filename);
  } catch (err) {
    return { success: false, errors: [err], doc: null, code: null };
  }

  // Validate
  const errors = validate(doc);
  if (errors.length > 0) {
    return { success: false, errors, doc, code: null };
  }

  // Generate
  try {
    const code = generate(doc);
    return { success: true, errors: [], doc, code };
  } catch (err) {
    return { success: false, errors: [err], doc, code: null };
  }
}

function printErrors(errors) {
  for (const err of errors) {
    const category = err.category || 'Error';
    const ctx = err.context?.path ? ` ${colorize(c.dim, `at ${err.context.path}`)}` : '';
    console.error(`  ${colorize(c.red, `✗ [${category}]`)}${ctx} ${err.message}`);
  }
}

// ── Commands ────────────────────────────────────────────────────────────────
switch (command) {
  case 'validate': {
    console.log(colorize(c.cyan, `Validating ${path.basename(resolvedPath)}...`));
    const result = runPipeline(resolvedPath);

    if (result.success) {
      console.log(colorize(c.green, `  ✓ Valid YSpec (${result.doc.kind}: ${result.doc.name})`));
      process.exit(0);
    } else {
      console.error(colorize(c.red, `  Found ${result.errors.length} error(s):`));
      printErrors(result.errors);
      process.exit(1);
    }
    break;
  }

  case 'generate': {
    const result = runPipeline(resolvedPath);

    if (!result.success) {
      console.error(colorize(c.red, `Validation failed for ${path.basename(resolvedPath)}:`));
      printErrors(result.errors);
      process.exit(1);
    }

    if (flags.output) {
      const outPath = path.resolve(flags.output);
      fs.writeFileSync(outPath, result.code, 'utf-8');
      console.log(colorize(c.green, `✓ Generated ${path.basename(outPath)} from ${path.basename(resolvedPath)} (${result.doc.kind}: ${result.doc.name})`));
    } else {
      process.stdout.write(result.code);
    }
    break;
  }

  case 'watch': {
    if (!flags.output) {
      console.error(colorize(c.red, 'Error: watch requires -o <output> flag'));
      process.exit(1);
    }

    const outPath = path.resolve(flags.output);
    console.log(colorize(c.cyan, `Watching ${path.basename(resolvedPath)} → ${path.basename(outPath)}`));
    console.log(colorize(c.dim, 'Press Ctrl+C to stop.\n'));

    // Initial generation
    const initial = runPipeline(resolvedPath);
    if (initial.success) {
      fs.writeFileSync(outPath, initial.code, 'utf-8');
      console.log(colorize(c.green, `  ✓ Generated (${timestamp()})`));
    } else {
      console.error(colorize(c.red, `  ✗ Errors (${timestamp()}):`));
      printErrors(initial.errors);
    }

    // Watch for changes
    let debounce = null;
    fs.watch(resolvedPath, (eventType) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          const result = runPipeline(resolvedPath);
          if (result.success) {
            fs.writeFileSync(outPath, result.code, 'utf-8');
            console.log(colorize(c.green, `  ✓ Regenerated (${timestamp()})`));
          } else {
            console.error(colorize(c.red, `  ✗ Errors (${timestamp()}):`));
            printErrors(result.errors);
          }
        } catch (e) {
          console.error(colorize(c.red, `  ✗ Crash: ${e.message}`));
        }
      }, 100);
    });
    break;
  }

  case 'run': {
    const result = runPipeline(resolvedPath);

    if (!result.success) {
      console.error(colorize(c.red, `Compilation failed for ${path.basename(resolvedPath)}:`));
      printErrors(result.errors);
      process.exit(1);
    }

    // Write to temp file and execute with Node
    const tmpDir = path.join(path.dirname(resolvedPath), '.yspec-out');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, path.basename(resolvedPath, '.yspec') + '.js');
    fs.writeFileSync(tmpFile, result.code, 'utf-8');

    try {
      execSync(`node "${tmpFile}"`, { stdio: 'inherit', cwd: path.dirname(resolvedPath) });
    } catch (e) {
      process.exit(e.status || 1);
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      try { fs.rmdirSync(tmpDir); } catch (_) {}
    }
    break;
  }

  case 'build': {
    const result = runPipeline(resolvedPath);

    if (!result.success) {
      console.error(colorize(c.red, `Compilation failed for ${path.basename(resolvedPath)}:`));
      printErrors(result.errors);
      process.exit(1);
    }

    const outPath = flags.output
      ? path.resolve(flags.output)
      : resolvedPath.replace(/\.yspec$/, '.js');
    fs.writeFileSync(outPath, result.code, 'utf-8');
    console.log(colorize(c.green, `✓ Compiled ${path.basename(resolvedPath)} → ${path.basename(outPath)}`));
    break;
  }

  default:
    console.error(colorize(c.red, `Unknown command: ${command}`));
    showHelp();
    process.exit(1);
}

function timestamp() {
  return new Date().toLocaleTimeString();
}
