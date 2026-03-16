# Contributing

## Development setup

```bash
npm install
npm run compile
```

Press `F5` to start an Extension Development Host.

For continuous rebuilds while developing:

```bash
npm run watch
```

## Running the web extension locally

Build the browser bundle:

```bash
npm run package-web
```

For continuous web-bundle rebuilds while editing:

```bash
npm run watch-web
```

Run the extension in VS Code's web extension host from desktop VS Code:

- open Run and Debug
- choose `Run Web Extension`
- press `F5`

This opens an Extension Development Host where the extension runs from the `browser` entry in `dist/web/extension.js`.

To open a browser-hosted VS Code for the Web session directly:

```bash
npm run open:web
```

This:
- rebuilds the desktop test helpers and the web bundle
- starts a local VS Code for the Web server on `http://localhost:3010`
- opens your default browser to that URL

Useful overrides:

```bash
TABLETEST_WEB_PORT=3020 npm run open:web
TABLETEST_WEB_OPEN=0 npm run open:web
```

- `TABLETEST_WEB_PORT` changes the local port.
- `TABLETEST_WEB_OPEN=0` starts the server without opening a browser automatically.

## Test commands

```bash
npm test
```

`npm test` runs the fast unit gate:
- formatter tests (`test:formatter`)
- grammar tests (`test:grammar`)

Additional commands:

```bash
npm run package-web
npm run open:web
npm run test:integration:web
npm run test:integration:strict
npm run test:full
npm run release:prepare -- 0.0.7
npm run release:notes -- 0.0.7
```

- `npm run test:integration` launches the VS Code host with the looser local defaults and may skip in environments where the host cannot start.
- `npm run test:integration:strict` is the recommended integration command when you want CI-like behaviour locally.
- `npm run test:integration:web` runs the browser-hosted smoke suite against the web extension.
- `npm run test:full` runs the fast unit gate, strict desktop integration, and the browser-hosted web smoke suite.

Integration tests launch a VS Code host. The runner attempts to install the Kotlin extension (`fwcd.kotlin`) before executing tests.

- Kotlin assertions are skipped when Kotlin support is unavailable and `TABLETEST_REQUIRE_KOTLIN` is not set.
- In headless/sandboxed environments where the VS Code test host cannot start, integration tests are skipped unless `TABLETEST_INTEGRATION_STRICT=1` is set.
- To reproduce CI compatibility checks locally, set `TABLETEST_VSCODE_VERSION` explicitly, for example `TABLETEST_VSCODE_VERSION=1.85.0 npm run test:integration:strict` or `TABLETEST_VSCODE_VERSION=stable npm run test:integration:strict`.
- `npm run test:integration:web` downloads and caches a VS Code for the Web runtime in `.vscode-test-web/` on first run.

## Release workflow

Release automation is configured in `.github/workflows/release.yml` and triggers on tags matching `v*.*.*`.
Release preparation automation lives in `.github/workflows/prepare-release.yml`, and automatic tagging for merged release PRs lives in `.github/workflows/tag-release.yml`.

### Required secrets

Set these in GitHub repository settings:
- `VSCE_PAT`: token for publishing to Visual Studio Marketplace (required for Marketplace publish)
- `OVSX_PAT`: token for publishing to Open VSX (optional)

### Release steps

1. Run the `Prepare Release` workflow from `main` with the target version (for example `0.0.7`).
   - The workflow updates `package.json`, `package-lock.json`, and `CHANGELOG.md`, then opens a PR from `release/v0.0.7`.
   - For a local dry run, use `npm run release:prepare -- 0.0.7`.
2. Review and merge the release PR into `main`.
3. The `Tag Release` workflow automatically creates the matching `v*.*.*` tag after a `release/v*` PR is merged into `main`, then dispatches the `Release` workflow for that tag.
   - It does not run for ordinary trunk-based commits to `main`.
4. The release workflow then:
   - validates tag/version match
   - runs `npm run test:unit`
   - runs `npm run test:integration:strict`
   - runs `npm run test:integration:web`
   - builds a `.vsix`
   - creates a GitHub Release using the matching `CHANGELOG.md` section as the release notes
   - publishes to Marketplace if `VSCE_PAT` is configured
   - publishes to Open VSX if `OVSX_PAT` is configured
