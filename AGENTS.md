# tabletest-vscode

VS Code extension: TableTest syntax highlighting and formatting for `.table` files and
embedded `@TableTest` tables in Java/Kotlin. See CONTRIBUTING.md for setup.

## Stack & layout

TypeScript, bundled with webpack for the web build (`webpack.web.config.js`). `src/` is
extension source; `syntaxes/` holds the TextMate grammars (source of truth for
highlighting); `language-configuration.tabletest.json` is the language config.

## Build & test

- Compile: `npm run compile` (web: `npm run package-web`).
- Unit: `npm test` — formatter tests plus grammar tests (`vscode-tmgrammar-test` against
  `tests/grammar/**/*.syntax`).
- Integration: `npm run test:integration`; full suite: `npm run test:full`.
- Package VSIX: `npm run package`.

## Commits

No commit-msg hook — by hand: conventional commits, first line under 50 chars, no
AI-attribution footer.
