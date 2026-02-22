const assert = require('assert');
const path = require('path');
const parser = require(path.join(__dirname, '..', 'out', 'parser.js'));

function testFormat(input, expected, name) {
  const got = parser.formatTableString(input);
  try {
    assert.strictEqual(got, expected);
    console.log(`PASS: ${name}`);
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error('Input:\n', input);
    console.error('Expected:\n', expected);
    console.error('Got:\n', got);
    throw e;
  }
}

// Test cases
const cases = [
  {
    name: 'simple two-column',
    input: 'a|b\n1|22',
    expected: 'a | b\n1 | 22'
  },
  {
    name: 'leading/trailing pipes and spaces',
    input: '  foo | bar \n baz|qux  ',
    expected: 'foo | bar\nbaz | qux'
  },
  {
    name: 'uneven columns',
    input: 'h|header2|header3\n1|two|three\nlonger|x|y',
    expected: 'h      | header2 | header3\n1      | two     | three\nlonger | x       | y'
  },
  {
    name: 'comments and blank lines',
    input: 'a|b\n// keep this\n\n1|2',
    expected: 'a | b\n// keep this\n\n1 | 2'
  }
];

for (const c of cases) {
  testFormat(c.input, c.expected, c.name);
}

console.log('\nAll tests passed.');
