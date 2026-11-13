# Piarre

Piarre is a centralized AI orchestrator for seeing, directing, and verifying agent work. Agent visibility is the primary product direction; typed discussion is a supporting tool and voice is deferred.

The implementation backlog lives in [GitHub Project 8](https://github.com/users/sysung/projects/8/views/1).

The [product requirements](docs/01_PRODUCT_PRD.md) describe the business problem, design principles, and intended experience.

The [documentation index](docs/00_README.md) links current behavior in OpenSpec, product direction, and technical design.

## Install a package

Open [GitHub Releases](https://github.com/sysung/piarre/releases), choose the build for the source commit you want, and download its `.vsix` asset. In VS Code, run **Extensions: Install from VSIX...** and select the file. Reload VS Code, open a trusted Git repository, and run **Piarre: Open**. The package requires VS Code 1.144.0 or later.

Every successful master push publishes the exact tested VSIX, `build-info.json`, and `SHA256SUMS` as a regular GitHub Release. Tags use `build-<full-source-sha>`; no separate release branch or daily schedule is maintained. The VSIX keeps the extension manifest version, so compare source commits and checksums when choosing between builds with the same version. Concurrent builds do not automatically replace GitHub's Latest designation.

PR and master builds also retain the existing **piarre-vsix** Actions artifacts for 30 days. Downloading those artifacts requires signing in and unzipping them. Maintainers can run CI manually on master with **create_release** enabled, which is the default. Disable it for a checks-only manual run. Failed quality or installed-package tests block release. A retry can recover an incomplete upload; an already published build is left unchanged. Releases are staged as drafts only while assets upload, then published automatically. This workflow never publishes to the VS Code Marketplace or installs into daily use, and a package does not establish integrated-product readiness.

## Develop the extension

Use Node.js 22, as recorded in `.nvmrc`. A fresh checkout needs no global build tools:

```sh
nvm use
npm ci
npm run check
npm test
```

On headless Linux, run the smoke test with `xvfb-run -a npm test`.

To launch the extension manually, open this repository in VS Code, select **Run Piarre Extension**, and press F5. In the Extension Development Host, open the Command Palette and run **Piarre: Open**.

Open and trust a local Git repository in the development host. For Work panel behavior and controls, see [project state](openspec/specs/project-state/spec.md) and [goal proposals](openspec/specs/goal-proposals/spec.md).

Local macOS Host tests open VS Code windows. Enable them deliberately with `PIARRE_GUI_TESTS=1 npm test` or `PIARRE_GUI_TESTS=1 npm run test:package --workspace apps/vscode`. Without that flag, the launcher stops before creating a profile or opening a window. CI Host runs remain enabled. `npm run check`, packaging, compilation and filtered Node tests do not need the flag.
