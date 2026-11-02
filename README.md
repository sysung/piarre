# Piarre

Piarre is a conversational project partner for organizing, directing, and verifying agent work. The initial product is typing-first, with optional voice planned.

The implementation backlog lives in [GitHub Project 8](https://github.com/users/sysung/projects/8/views/1).

The [product requirements](docs/01_PRODUCT_PRD.md) describe the business problem, design principles, and intended experience.

The [documentation index](docs/00_README.md) links the four lasting project documents. Requirements describe intended behavior, not implemented capabilities.

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
