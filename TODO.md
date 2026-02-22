# TODO

## First pass: confirm current behaviour
- [x] Run formatter sample script (`node scripts/runFormatter.js`) to see current output vs expected.
- [x] Run tests (`npm test`) and record current failures (if any). (Formatter + grammar tests currently pass.)
- [x] Manually verify syntax highlighting in Extension Development Host using `samples/SampleTableTest.java`.

## Formatting (behaviour + robustness)
- [x] Fix range formatting: `TableTestFormatter` ignores `offsetPos` and formats by string indexes that assume full-document offsets.
- [x] Use the `indent` captured by `extractTripleQuotedTables` or compute indent from the string literal start to preserve alignment.
- [x] Implement best-effort "graceful degradation": return unchanged for malformed/unparseable tables (currently based on invalid collection syntax).
- [ ] Highlight invalid characters when graceful degradation triggers (surface parse errors).
- [x] Preserve empty rows inside tables instead of dropping blank lines.
- [x] Detect and skip non-table multiline strings (only format actual TableTest tables).
- [x] Handle ragged rows by aligning existing columns only (no new trailing columns).
- [x] Ensure formatting is stable when there are multiple `@TableTest` blocks in one file.
- [x] Add collection formatting (lists/sets/maps) with spacing normalisation; maps use `:`; preserve quotes.
- [x] Preserve comments and blank lines without data loss.
- [x] Add Unicode-aware width calculation (wcwidth-style) for alignment.
- [x] Support empty cell handling explicitly (e.g. `a||c` keeps empty middle cell).
- [ ] Support base-indent + configurable extra indent (EditorConfig), even if best-effort.

## Parsing / extraction
- [x] Make `extractTripleQuotedTables` resilient to nested parentheses in `@TableTest(...)` and to other annotations with triple-quoted strings.
- [ ] Support Kotlin raw strings and Java text blocks consistently (including `"""` in Java and `"""` in Kotlin).
- [x] Add tests for edge cases: leading/trailing newlines, indentation, multiple tables, and non-TableTest triple-quoted strings.
- [x] Add parsing for comments/blank lines so formatter can preserve them.
- [x] Add parsing for collections and quoted values to enable best-effort normalisation.

## Java parser reference notes (tabletest-parser)
- [x] Unquoted values allow `,` and `:` after the first character; acceptable because list/map values must start with `[` and sets with `{`. `a:b` is only map syntax inside brackets; otherwise it is a string (RowParser.unquotedValue).
- [x] Unquoted element values allow `{`, `[`, and quotes after the first character; acceptable given list/map/set tokens are determined by leading `[`/`{` (RowParser.unquotedElementValue).
- [x] Map keys allow `{`, `}`, and quotes after the first character; acceptable given no single-character escaping and quotes are required when needed (RowParser.mapKey).
- [x] Quoted strings do not support escapes like `\"` or `\'`; expected by design (RowParser.single/doubleQuotedValue).
- [x] Line splitting uses `\n` only; CRLF normalisation not required per current tooling (TableParser).

## Syntax highlighting (TextMate grammar)
- [x] Add grammar test harness and initial tests.
- [x] Ensure highlighting activates only inside the TableTest string literal, not across the whole annotation argument list.
- [x] Disambiguate list vs map: both use `[...]` in the grammar; currently both patterns overlap.
- [x] Add scopes for header row vs data rows (no semantic tokens implemented yet).
- [x] Expand grammar tests further using the existing `vscode-tmgrammar-test` harness (additional Java/Kotlin edge cases).
- [ ] Kotlin: validate raw-string edge cases and decide if Java/Kotlin terminator rules should diverge (TextMate injection now enabled).
- [ ] Edge case: Kotlin raw strings treat backslash literally; we currently avoid terminating on `\"""`, which can ignore an actual terminator in invalid Kotlin strings. Acceptable for now.
- [x] Allow line comments (`//`) between `@TableTest(` and opening `"""` when detecting the implicit value.

## Automated tests
- [x] Create formatter unit tests in TypeScript and wire them into `npm test`.
- [x] Add syntax highlighting tests (golden scopes) for Java and Kotlin samples.
- [x] Wire grammar tests into `npm test`.
- [x] Add dedicated extraction tests for `extractTripleQuotedTables` (start/end positions, indentation, multiple tables, implicit vs named `value`).
- [x] Add formatter tests for collection spacing.
- [x] Add formatter tests for Unicode width alignment (CJK/emoji).
- [x] Add CI workflow to run tests on each push (optional but recommended).
- [x] Stabilise integration tests in local/CI runs by skipping in unsupported headless/sandboxed environments; strict mode available via `TABLETEST_INTEGRATION_STRICT=1`.
