# Piarre

Piarre is a proposed voice-first IDE for directing, observing, and verifying coding agents.

The implementation plan lives in [GitHub Project 8](https://github.com/users/sysung/projects/8/views/1) and the [backlog document](docs/03_IMPLEMENTATION_BACKLOG.md). The retired A00 experiment is preserved only as [dated findings](docs/history/a00-findings.md).

The [product design](docs/01_PRODUCT_PRD.md) describes the audience, product model, proposed features, voice interaction, primary UI, trust boundaries, and staged path from one supervised worker to an isolated agent team.

The [design package](docs/00_README.md) links the current product and delivery documents. Planning material describes proposals, not implemented capabilities.

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

Open and trust a local Git repository in the development host. Piarre shows its Work tab with the project name, ID, and revision. **Piarre: Rename Project** changes the name. Reloading the window restores the project from its event log. Project data is stored in VS Code extension storage, outside the repository.
