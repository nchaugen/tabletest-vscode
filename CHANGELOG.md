# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Java `@TableTest` support for static string-array table literals (implicit and named `value = { ... }` forms).
- Parser extraction for Java string-array rows with source-offset metadata and decoded-content mappings for escapes.
- Formatter support for Java string-array tables with canonical rendering:
  - one string row per line
  - aligned pipes and normalised collection syntax
  - trailing-space padding so closing quotes align
  - implicit-form adjacency enforcement as `@TableTest({` ... `})`
- Grammar coverage for Java string-array tables, including header/data row scopes and collection/map-key scopes inside array rows.
- Additional Java grammar coverage for fully-qualified annotation names (for example `@org.tabletest.junit.TableTest(...)`).
- Regression tests for escaped quote handling in Java string-array rows.

### Changed

- Unified annotation table extraction API to support both text-block and string-array table forms.
- Java default indentation behaviour now follows Java formatter continuation indentation when `tabletest.format.extraIndentLevel` is not explicitly configured.
- Java formatter-profile resolution now supports broader path formats and variable expansion (`file:...`, `${workspaceFolder...}`, `${env:...}`, `~/...`), with robust XML attribute parsing.
- Documentation and configuration descriptions were updated to reflect Java formatter-driven default indentation for both text blocks and string arrays.

### Fixed

- Java string-array table highlighting regression where rows/collections could fall back to plain string scopes.
- Array-row collection highlighting with whitespace around pipes (for example `| {x, y} | [k: v]`).
- False malformed-collection diagnostics for escaped quotes in Java string-array rows (for example `\"`).
- Formatter ping-pong between Java formatter and TableTest formatter for Java annotation text blocks and string-array tables.

## [0.0.5] - 2026-02-23

### Added

- Theme-aware comment highlighting for `//` table comments in `.table`, Java, and Kotlin table contexts.
- Dedicated map key highlighting scope for map literals (`support.type.property-name.tabletest`).
- Recursive syntax highlighting for nested list/set/map values.
- Warnings for additional malformed collection patterns:
  - trailing-comma empty elements (for example `[a, b,]`)
  - map entries without values (for example `[key:]`)
  - map values with extra top-level colons (for example `[a: b:c:d]`)

### Changed

- Extension activation now includes `onLanguage:java` and `onLanguage:kotlin`, so diagnostics appear without running formatting first.
- Extension metadata keywords were expanded for discovery in Marketplace search.
- Release packaging now includes repository metadata and an explicit `.vscodeignore` to avoid shipping development-only files.

### Fixed

- Nested collection values that were previously tokenized as plain unquoted text now receive correct collection scopes.

## [0.0.4] - 2026-02-22

### Added

- Header-specific grammar scope for table header cells (`entity.name.column.tabletest`).
- Wider Unicode coverage for alignment tests (emoji sequences, keycaps, flags, and mixed scripts).
- Tab-width regression tests for width calculation and formatter output.

### Changed

- Formatter width calculation is now grapheme-aware for Unicode and emoji.
- Tab expansion is now aligned to tab stops using actual column start offsets.
- Formatter now resolves table tab size from document editor settings before runtime fallback.

### Fixed

- Comment indentation drift when reformatting tables with mixed row indentation.
- Closing triple-quote alignment after formatting Java/Kotlin annotation tables.
- Java table indentation consistency when one file reports different runtime tab-size options.
- Header token colouring now differs reliably from data rows across themes.

## [0.0.3] - 2026-02-22

### Added

- Publishing setup for VS Code Marketplace under `tabletest` publisher.
- Configurable extra table indentation via `tabletest.format.extraIndentLevel`.
- Diagnostics for malformed collection cells in tables.
- CI workflows for tests, integration checks, and tagged releases.

### Changed

- Java/Kotlin `@TableTest` value parsing to better match real annotation usage.
- Kotlin default table indentation behaviour to align with common triple-quote style.
- README and extension metadata for marketplace use (icon, install guidance, docs links).

### Fixed

- Java/Kotlin injection grammar edge cases around triple-quoted content.
- Release workflow validation and token-gated publishing steps.

## [0.0.2] - 2026-02-22

### Added

- Initial VS Code extension implementation for TableTest tables.
- `.table` language support with syntax highlighting.
- Java/Kotlin annotation injection highlighting for `@TableTest("""...""")`.
- Table formatting command (`TableTest: Format All Tables in Document`).
- Core cell normalisation and column alignment for TableTest table syntax.

[Unreleased]: https://github.com/nchaugen/tabletest-vscode/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/nchaugen/tabletest-vscode/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/nchaugen/tabletest-vscode/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/nchaugen/tabletest-vscode/releases/tag/v0.0.3
