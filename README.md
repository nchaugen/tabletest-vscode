# TableTest (VS Code)

VS Code extension for TableTest tables used in JUnit tests.

It provides:
- syntax highlighting for TableTest table syntax
- auto-formatting for aligned `|` columns and normalised cell values
- support for tables in Java, Kotlin, and standalone `.table` files

## Current behaviour

| Context | Highlighting | Formatting |
| --- | --- | --- |
| `.table` file | ✅ `source.tabletest` grammar | ✅ Standard `Format Document` / `Format Selection` (default formatter is this extension) |
| Java / Kotlin `@TableTest(...)` triple-quoted string | ✅ TextMate injection in `source.java` and `source.kotlin` | ✅ Command: `TableTest: Format All Tables in Document` |

Formatting is intentionally exposed as a command for Java/Kotlin, so normal Java/Kotlin formatter entry points are not overridden.

## Table syntax support

Cell values can be:
- empty
- unquoted text
- single-quoted or double-quoted strings
- lists: `[a, b, c]`
- sets: `{a, b, c}`
- maps: `[k: v, x: y]`
- nested combinations of the above

## What formatting does

- aligns columns by pipe separators
- preserves empty cells (for example `a||c`)
- normalises spacing in collection values (lists/sets/maps)
- preserves quoted values
- preserves line comments (`//`) and blank lines without data loss
- uses Unicode-aware display width for alignment (CJK/emoji)
- falls back to no change if a table looks malformed (best-effort graceful degradation)

## Quick example

Before:

```text
a|b
[1,2]|[k:v]
```

After:

```text
a      | b
[1, 2] | [k: v]
```

## Java/Kotlin usage

Use Command Palette:
- `TableTest: Format All Tables in Document`

Typical supported annotation forms:
- `@TableTest("""...""")`
- `@TableTest(value = """...""")`

## Development

```bash
npm install
npm run compile
```

Press `F5` to start an Extension Development Host.

## Testing

```bash
npm test
```

`npm test` currently runs:
- formatter tests (`test:formatter`)
- grammar tests (`test:grammar`)

Additional test command:

```bash
npm run test:integration
```

Integration tests launch a VS Code host and install the Kotlin extension.

## Known limitations

- Table extraction in Java/Kotlin uses a lightweight scanner, not a full Java/Kotlin parser.
- `value` is extracted only from a direct triple-quoted literal: either explicit `value = """..."""` or a single implicit positional argument with no named arguments.
- Invalid syntax is handled by skipping formatting rather than showing diagnostics.
- EditorConfig-driven indentation is not implemented yet.
