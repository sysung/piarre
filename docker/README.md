# Run Piarre in Docker

This runs the pinned desktop VS Code build with Piarre installed, displayed in your browser through noVNC. Your desktop VS Code installation, extensions, settings, and Codex login are separate.

## Start

Start the Docker engine through its CLI, then run the launcher from the repository root:

```sh
docker desktop start
npm run docker:up
```

Open [the container desktop](http://localhost:6080). Trust the mounted folder when VS Code asks, then open Piarre. The npm launcher uses a temporary credential-free Docker configuration for public images, avoiding desktop keychain prompts while preserving your selected local Docker engine. Your Docker configuration is unchanged.

The first image build downloads VS Code and dependencies; later builds reuse Docker’s cache.

The default workspace is:

```text
/Users/sysung98/Library/CloudStorage/GoogleDrive-sysung98@gmail.com/My Drive/Obsidian/Steven's Vault/Career/Nvidia/leet
```

It is mounted read/write at `/workspace`. Edits there affect that host folder. Piarre’s database and VS Code settings stay in a separate named volume, with a distinct profile for each host folder. Switching workspace mounts preserves separate session histories.

To mount another existing folder, supply its absolute path:

```sh
npm run docker:up -- "/absolute/path/to/repository"
```

You can also use environment variables with Compose directly:

```sh
PIARRE_WORKSPACE="/absolute/path/to/repository" PIARRE_PORT=6081 docker compose up --build -d
```

`PIARRE_PORT` defaults to `6080`. The desktop is published on `127.0.0.1` only. `PIARRE_SCREEN` sets its resolution, for example `1920x1080x24`.

## Connect Codex

Sign in once inside the container:

```sh
npm run docker:login
```

Follow the displayed device-login instructions in your browser, then select **Connect with Codex** in Piarre. If device login is unavailable for your account, follow the [Codex headless authentication guidance](https://learn.chatgpt.com/docs/auth).

The container has its own Codex credential volume. Host credentials, SSH keys, Git credentials, and the Docker socket are not mounted. Signing in does not send a chat message. Credentials remain in the named volume when you stop the container.

## Stop and update

```sh
npm run docker:down
```

Stop preserves both named volumes and all workspace files. Run `npm run docker:up` again after changing the extension; it rebuilds and installs the current extension into the image. Docker reuses your container’s saved profile and Codex login.

To inspect startup logs:

```sh
docker compose logs --tail=100 piarre
```

If Docker reports that the workspace mount is denied, allow that folder in Docker Desktop’s file-sharing settings and ensure Google Drive has downloaded the files locally. A missing source directory is rejected instead of silently creating one.

## Runtime details

The image supports Linux ARM64 and AMD64. It runs as the unprivileged `node` user. VS Code uses `--no-sandbox` for its Electron renderer inside the container; the container does not receive privileged mode, host networking, or the Docker socket. The browser connection stays on your local machine. Codex generation still requires sign-in and Piarre’s existing review controls.

Piarre's contained coding checks currently support macOS only. They remain unavailable in this Linux container. Chat, saved sessions, sourced context, and read-only coordination can be tested here; a healthy desktop does not prove authenticated model access.

VS Code is pinned to `config/vscode-version.mjs` by the npm launcher. Its Dockerfile default matches that pin. The Codex CLI is pinned separately in the Dockerfile. The actual desktop runtime preserves the extension’s Electron/SQLite behavior.

Sources: [VS Code Linux packages](https://code.visualstudio.com/docs/setup/linux), [noVNC](https://github.com/novnc/noVNC), and [Codex authentication](https://learn.chatgpt.com/docs/auth).
