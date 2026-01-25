#!/usr/bin/env node
/**
 * Validates qopilot extension before deployment
 * Catches common issues like missing 'items' in array schemas
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const outDir = path.join(__dirname, '..', 'out');

let errors = [];
let warnings = [];

function error(msg) {
  errors.push(`❌ ${msg}`);
}

function warn(msg) {
  warnings.push(`⚠️  ${msg}`);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

// 1. Check package.json exists and is valid JSON
console.log('\n=== Validating package.json ===\n');

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  ok('package.json is valid JSON');
} catch (e) {
  error(`package.json parse error: ${e.message}`);
  process.exit(1);
}

// 2. Check required fields
const required = ['name', 'version', 'engines', 'main', 'contributes'];
for (const field of required) {
  if (!pkg[field]) {
    error(`Missing required field: ${field}`);
  } else {
    ok(`Has ${field}`);
  }
}

// 3. Validate languageModelTools schemas
console.log('\n=== Validating Tool Schemas ===\n');

const tools = pkg.contributes?.languageModelTools || [];
if (tools.length === 0) {
  warn('No languageModelTools defined');
} else {
  ok(`Found ${tools.length} tool(s)`);
}

function validateSchema(schema, path = 'root') {
  if (!schema || typeof schema !== 'object') return;
  
  // Check array types have items
  if (schema.type === 'array') {
    if (!schema.items) {
      error(`${path}: array type MUST have 'items' property`);
    } else {
      ok(`${path}: array has items`);
      validateSchema(schema.items, `${path}.items`);
    }
  }
  
  // Recurse into properties
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      validateSchema(value, `${path}.${key}`);
    }
  }
}

for (const tool of tools) {
  console.log(`\nTool: ${tool.name}`);
  
  if (!tool.name) {
    error('Tool missing name');
    continue;
  }
  
  if (!tool.inputSchema) {
    warn(`${tool.name}: no inputSchema`);
    continue;
  }
  
  validateSchema(tool.inputSchema, tool.name);
}

// 4. Check compiled output exists
console.log('\n=== Validating Build Output ===\n');

const mainFile = path.join(outDir, 'extension.js');
if (fs.existsSync(mainFile)) {
  const stats = fs.statSync(mainFile);
  const age = (Date.now() - stats.mtimeMs) / 1000;
  ok(`extension.js exists (modified ${age.toFixed(0)}s ago)`);
  
  // Check it's not empty
  const size = stats.size;
  if (size < 1000) {
    warn(`extension.js is suspiciously small (${size} bytes)`);
  } else {
    ok(`extension.js size: ${(size/1024).toFixed(1)}KB`);
  }
} else {
  error('extension.js not found - run npm run compile first');
}

// Summary
console.log('\n=== Summary ===\n');

if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach(w => console.log(`  ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('Errors:');
  errors.forEach(e => console.log(`  ${e}`));
  console.log(`\n❌ Validation FAILED with ${errors.length} error(s)\n`);
  process.exit(1);
} else {
  console.log(`✅ Validation PASSED\n`);
  process.exit(0);
}
