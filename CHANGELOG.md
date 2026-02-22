# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- No changes yet.

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

[Unreleased]: https://github.com/nchaugen/tabletest-vscode/compare/v0.0.4...HEAD
[0.0.4]: https://github.com/nchaugen/tabletest-vscode/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/nchaugen/tabletest-vscode/releases/tag/v0.0.3
