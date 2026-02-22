const fs = require('fs');
const path = require('path');

// require compiled parser only (formatter imports 'vscode' and isn't usable here)
const parser = require(path.join(__dirname, '..', 'out', 'parser.js'));

const samplePath = path.join(__dirname, '..', 'samples', 'SampleTableTest.java');
const text = fs.readFileSync(samplePath, 'utf8');

console.log('Original file:\n');
console.log(text);

// Use parser.extractTripleQuotedTables to find tables and format them
const tables = parser.extractTripleQuotedTables(text);
if (tables.length === 0) {
  console.log('\nNo @TableTest triple-quoted blocks found.');
  process.exit(0);
}

let out = text;
for (let i = tables.length - 1; i >= 0; i--) {
  const t = tables[i];
  const formatted = parser.formatTableString(t.content, t.indent);
  out = out.slice(0, t.start) + formatted + out.slice(t.end);
}

console.log('\nFormatted file:\n');
console.log(out);

// Note: we avoid requiring the compiled formatter because it depends on the 'vscode' module
// which isn't available in a plain Node script. The parser utilities are sufficient
// to demonstrate formatting behavior.
