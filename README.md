# TableTest (VS Code)

IDE support for TableTest tables used in JUnit data-driven tests.

Website and docs: [tabletest.org](https://tabletest.org)

## What is TableTest?

TableTest is a JUnit extension for writing data-driven tests as readable tables instead of repetitive test methods.

- Each column represents an input parameter or expected output
- Each row represents a test case

This style keeps test data clear, maintainable, and easy to extend.

## Features

- Syntax highlighting for TableTest tables
- Table auto-formatting with aligned `|` columns
- Cell value normalisation for lists/sets/maps
- Support for Java, Kotlin, and standalone `.table` files
- Warnings for malformed collection cells in tables
- Automatic language injection for `@TableTest` in Java and Kotlin

## Supported contexts

| Context | Highlighting | Formatting |
| --- | --- | --- |
| `.table` file | ✅ `source.tabletest` grammar | ✅ Standard `Format Document` / `Format Selection` |
| Java / Kotlin `@TableTest(...)` triple-quoted string | ✅ Injection grammar (`source.java` / `source.kotlin`) | ✅ `TableTest: Format All Tables in Document` |

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
- Lists: `[a, b, c]`
- Sets: `{a, b, c}`
- Maps: `[k: v, x: y]`
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

## Configuration

- `tabletest.format.extraIndentLevel` (user-configurable; by default Java behaves as `1`, Kotlin as `0`)
  - Adds extra indentation levels to formatted rows inside Java/Kotlin `@TableTest` triple-quoted strings.
  - Indent width follows VS Code formatting options (`tabSize` / `insertSpaces`) and respects EditorConfig-applied indentation.

## Limitations

- Annotation extraction in Java/Kotlin uses a lightweight scanner, not a full parser.
- `value` is extracted only from a direct triple-quoted literal:
  - explicit `value = """..."""`, or
  - single implicit positional argument with no named arguments.
- Diagnostics currently focus on malformed collection cells (lists/sets/maps).

## Contributing

Developer documentation and release workflow are in `CONTRIBUTING.md`.
