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
- reports malformed collection cells as VS Code diagnostics (warning)

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

### Formatting configuration

- `tabletest.format.extraIndentLevel` (default `0`)
  - Adds extra indentation levels to formatted rows inside Java/Kotlin `@TableTest` triple-quoted strings.
  - Indent width follows VS Code formatting options (`tabSize` / `insertSpaces`), so EditorConfig-applied indentation is respected.

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

Integration tests launch a VS Code host. The runner attempts to install the Kotlin extension (`fwcd.kotlin`) before executing tests. Kotlin assertions are skipped only when Kotlin support is unavailable and `TABLETEST_REQUIRE_KOTLIN` is not set. In headless/sandboxed environments where the VS Code test host cannot start, the integration runner exits with a skip message unless `TABLETEST_INTEGRATION_STRICT=1` is set.

## Release and distribution

Automated release is configured in `.github/workflows/release.yml`.

### Repository secrets

Set these in GitHub repository settings:
- `VSCE_PAT`: token for publishing to Visual Studio Marketplace (required for Marketplace publish)
- `OVSX_PAT`: token for publishing to Open VSX (optional)

### Release flow

1. Bump extension version in `package.json`.
2. Commit and push to `main`.
3. Create and push a matching tag:
   - if version is `0.0.3`, tag must be `v0.0.3`
4. The workflow then:
   - validates tag/version match
   - runs `npm test`
   - builds a `.vsix`
   - creates a GitHub Release and attaches the `.vsix`
   - publishes to Marketplace if `VSCE_PAT` is configured
   - publishes to Open VSX if `OVSX_PAT` is configured

## Known limitations

- Table extraction in Java/Kotlin uses a lightweight scanner, not a full Java/Kotlin parser.
- `value` is extracted only from a direct triple-quoted literal: either explicit `value = """..."""` or a single implicit positional argument with no named arguments.
- Diagnostics currently focus on malformed collection cells (lists/sets/maps) that cause formatting to be skipped.
