# Contributing

## Development setup

```bash
npm install
npm run compile
```

Press `F5` to start an Extension Development Host.

## Test commands

```bash
npm test
```

`npm test` runs:
- formatter tests (`test:formatter`)
- grammar tests (`test:grammar`)

Additional integration test command:

```bash
npm run test:integration
```

Integration tests launch a VS Code host. The runner attempts to install the Kotlin extension (`fwcd.kotlin`) before executing tests.

- Kotlin assertions are skipped when Kotlin support is unavailable and `TABLETEST_REQUIRE_KOTLIN` is not set.
- In headless/sandboxed environments where the VS Code test host cannot start, integration tests are skipped unless `TABLETEST_INTEGRATION_STRICT=1` is set.
- To reproduce CI compatibility checks locally, set `TABLETEST_VSCODE_VERSION` explicitly, for example `TABLETEST_VSCODE_VERSION=1.85.0 npm run test:integration:strict` or `TABLETEST_VSCODE_VERSION=stable npm run test:integration:strict`.

## Release workflow

Release automation is configured in `.github/workflows/release.yml` and triggers on tags matching `v*.*.*`.

### Required secrets

Set these in GitHub repository settings:
- `VSCE_PAT`: token for publishing to Visual Studio Marketplace (required for Marketplace publish)
- `OVSX_PAT`: token for publishing to Open VSX (optional)

### Release steps

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
