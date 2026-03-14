# TableTest (VS Code)

IDE support for TableTest tables used in JUnit data-driven tests.

Website and docs: [tabletest.org](https://tabletest.org)

## What is TableTest?

TableTest is a JUnit extension for writing data-driven tests as readable tables instead of repetitive test methods.

- Each column represents an input parameter or expected output
- Each row represents a test case

This style keeps test data clear, maintainable, and easy to extend.

## Features

- Rich syntax highlighting for TableTest tables:
  - Header cells
  - `//` table comments
  - Map keys (quoted or unquoted)
  - Nested list/set/map structures
- Table auto-formatting with aligned `|` columns
- Cell value normalisation for lists/sets/maps
- Support for Java, Kotlin, and standalone `.table` files
- Warnings for invalid table cell syntax, including:
  - unquoted scalar values that need quoting (for example `World, hello` or `key: value`)
  - unquoted map keys that need quoting (for example `[key with spaces: value]`)
  - trailing-comma empty elements (for example `[a, b,]`)
  - map entries without values (for example `[key:]`)
  - map values with extra top-level colons (for example `[a: b:c:d]`)
- Automatic language injection for `@TableTest` in Java and Kotlin, plus fully-qualified Java `@org.tabletest.junit.TableTest(...)`

## Supported contexts

| Context | Highlighting | Formatting |
| --- | --- | --- |
| `.table` file | ✅ `source.tabletest` grammar | ✅ Standard `Format Document` / `Format Selection` |
| Java / Kotlin `@TableTest(...)` triple-quoted string | ✅ Injection grammar (`source.java` / `source.kotlin`) | ✅ `TableTest: Format All Tables in Document` |
| Java `@TableTest({ ... })` string-array table | ✅ Java injection grammar | ✅ `TableTest: Format All Tables in Document` |

Formatting in Java/Kotlin is intentionally exposed as a command so normal Java/Kotlin formatter entry points are not overridden.

## Installation

From VS Code:
1. Open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for `TableTest`
3. Install the extension published by `tabletest`

Direct links:
- VS Code Marketplace: [TableTest for VS Code](https://marketplace.visualstudio.com/items?itemName=tabletest.tabletest)
- Companion IntelliJ plugin: [TableTest on JetBrains Marketplace](https://plugins.jetbrains.com/plugin/27334-tabletest)

Command line:

```bash
code --install-extension tabletest.tabletest
```

From local package (`.vsix`):
1. Open Extensions view
2. `...` menu -> `Install from VSIX...`
3. Select your `.vsix` file

## Getting started

1. Add TableTest dependency to your project alongside JUnit.

Maven:

```xml
<dependency>
  <groupId>org.tabletest</groupId>
  <artifactId>tabletest-junit</artifactId>
  <version>1.0.0</version>
  <scope>test</scope>
</dependency>
```

Gradle:

```groovy
testImplementation "org.tabletest:tabletest-junit:1.0.0"
```

2. Create a test using `@TableTest` and write test data as a table in the annotation.
3. Format your tables with `TableTest: Format All Tables in Document` from Command Palette.
4. Use standard VS Code shortcut to comment/uncomment lines: `Ctrl+/` (Windows/Linux) or `Cmd+/` (macOS).
5. Use standard VS Code shortcut to move lines up/down: `Alt+Up/Down` (Windows/Linux) or `Option+Up/Down` (macOS).

## Table syntax

Cell values can be:
- Empty
- Unquoted text
- Single-quoted or double-quoted strings
- Line comments: `// comment`
- Lists: `[a, b, c]`
- Sets: `{a, b, c}`
- Maps: `[k: v, "x": y, 'z': w]`
- Nested combinations of the above

## Example

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

Typical annotation forms:
- `@TableTest("""...""")`
- `@TableTest(value = """...""")`
- `@org.tabletest.junit.TableTest("""...""")` (Java)
- `@TableTest({ "header|value", "row|value" })` (Java)
- `@TableTest(value = { "header|value", "row|value" })` (Java)

## Configuration

- `tabletest.format.extraIndentLevel` (user-configurable; by default Kotlin behaves as `0`, while Java follows formatter continuation indentation)
  - Adds extra indentation levels to formatted rows inside Java/Kotlin `@TableTest` triple-quoted strings and Java string-array tables.
  - For Java, when this setting is not explicitly configured, TableTest reads `java.format.settings.url` profile values (`continuation_indentation_for_array_initializer` / `continuation_indentation`) and falls back to `2` levels if unavailable.
  - Indent width follows VS Code formatting options (`tabSize` / `insertSpaces`) and respects EditorConfig-applied indentation.

## Limitations

- Annotation extraction in Java/Kotlin uses a lightweight scanner, not a full parser.
- `value` is extracted only from a direct supported literal:
  - triple-quoted literal (`"""..."""`), or
  - Java static string-array literal (`{"...", "..."}`).
- For implicit Java string-array formatting, the formatter normalises boundaries to `@TableTest({` ... `})`.
- Implicit extraction is only used when there is exactly one positional argument and no named arguments.
- Diagnostics currently focus on syntax problems inside recognisable table cells, including malformed list/set/map values and unquoted values or map keys that require quoting.

## Contributing

Developer documentation and release workflow are in `CONTRIBUTING.md`.

Common local test commands:
- Fast unit suite: `npm test` or `npm run test:unit`
- Strict VS Code integration suite: `npm run test:integration:strict`
- Full local suite matching CI gates: `npm run test:full`
