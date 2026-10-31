# Test a reviewable task proposal

Use this guide to test issue B02 in the VS Code Extension Development Host. You will type a goal, inspect the saved proposal, and confirm that Piarre does not change the selected Git repository.

## Prepare the repository

1. Open this repository in VS Code.
2. Open a terminal in the repository root.
3. Install the pinned dependencies.

   ```sh
   nvm use
   npm ci
   ```

4. Record the current repository state.

   ```sh
   git status --short
   ```

Keep this VS Code window open. It is the development window.

## Start Piarre

1. Open **Run and Debug** in the development window.
2. Select **Run Piarre Extension**.
3. Press F5.
4. Wait for the Extension Development Host to open.

The development host opens this repository automatically. Trust the workspace if VS Code asks.

If macOS reports an AppKit or `HIServices._RegisterApplication` crash, launch the Extension Development Host outside a restricted automation sandbox. This crash occurs before Piarre starts.

## Create a proposal

1. Open the Command Palette in the Extension Development Host.
2. Run **Piarre: Propose Task**.
3. Enter a goal such as `Add a pricing page`.
4. Press Enter.

Piarre opens the **Piarre Work** tab. The proposal shows:

- the typed goal;
- the `Unapproved` state;
- plan version 1;
- one requirement that preserves the typed goal;
- proposed included and excluded paths;
- `No dependencies`;
- one manual review check;
- a proposed budget of 20,000 tokens, 15 minutes, and one attempt.

The first proposal is a deterministic initial draft. It does not inspect the repository or create a model-generated task breakdown. The empty proposed path list means that you must refine the scope before later approval and execution work.

## Check persistence

1. Close the **Piarre Work** tab.
2. Reload the Extension Development Host window.
3. Run **Piarre: Open**.

The **Piarre Work** tab shows the same proposal after reload. Piarre stores the proposal in VS Code extension storage, not in the selected repository.

## Check that the repository did not change

Run this command in the development window:

```sh
git status --short
```

The output must match the state that you recorded before you created the proposal.

This manual check covers tracked and untracked files reported by Git. The automated Extension Host test also compares file contents, file modes, ignored files, `.git` contents, and symbolic-link targets.

## Run the automated checks

Run the build, lint, type, and package checks:

```sh
npm run check
```

Run the contract tests:

```sh
npm run test:contract
```

Run the VS Code Extension Host tests:

```sh
npm run test:smoke --workspace apps/vscode
```

The smoke suite requires permission to launch a macOS GUI application. In Codex, run this command outside the normal filesystem sandbox. A sandboxed launch can abort inside AppKit before the extension activates.

The trusted host currently covers proposal validation, persistence, replay, stable identities, rendering, and the selected-repository no-write check. A second restricted host confirms that an untrusted workspace does not create project state.

## Current limits

- The interpreter creates one conservative deterministic task.
- The proposal cannot be edited or approved yet.
- Piarre does not start a coding worker.
- Voice input is not part of B02.
