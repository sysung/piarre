import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vscodeVersion } from "../config/vscode-version.mjs";

const defaultWorkspace = "/Users/sysung98/Library/CloudStorage/GoogleDrive-sysung98@gmail.com/My Drive/Obsidian/Steven's Vault/Career/Nvidia/leet";
const root = fileURLToPath(new URL("../", import.meta.url));
const [action = "up", ...args] = process.argv.slice(2);
const workspace = args[0] ?? process.env.PIARRE_WORKSPACE ?? defaultWorkspace;
let publicConfig;
function docker(argv, env) {
  const result = spawnSync("docker", argv, { cwd: root, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker exited with status ${String(result.status ?? "unknown")}.`);
}
try {
  if (!["up", "down", "login"].includes(action) || args.length > (action === "up" ? 1 : 0)) throw new Error("Use up [workspace], down, or login.");
  if (action === "up" && (!path.isAbsolute(workspace) || !existsSync(workspace) || !statSync(workspace).isDirectory())) throw new Error("Supply one existing absolute workspace directory.");
  const env = { ...process.env, PIARRE_WORKSPACE: workspace };
  const context = spawnSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" });
  if (context.error) throw context.error;
  const endpoint = process.env.DOCKER_HOST ?? (context.status === 0 ? context.stdout.trim() : "");
  if (endpoint.startsWith("unix://")) {
    // Public images do not need the desktop keychain or registry credentials.
    const original = process.env.DOCKER_CONFIG ?? path.join(homedir(), ".docker");
    const configPath = path.join(original, "config.json");
    const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
    const extras = Array.isArray(config.cliPluginsExtraDirs) ? config.cliPluginsExtraDirs.filter(value => typeof value === "string") : [];
    publicConfig = mkdtempSync(path.join(tmpdir(), "piarre-docker-"));
    writeFileSync(path.join(publicConfig, "config.json"), JSON.stringify({ cliPluginsExtraDirs: [path.join(original, "cli-plugins"), ...extras] }));
    env.DOCKER_CONFIG = publicConfig;
    env.DOCKER_HOST = endpoint;
  }
  if (action === "up") {
    docker(["compose", "build", "--build-arg", `VSCODE_VERSION=${vscodeVersion}`], env);
    docker(["compose", "up", "-d", "--wait"], env);
    console.log(`Open http://localhost:${process.env.PIARRE_PORT ?? "6080"} · mounted ${workspace} at /workspace`);
  } else if (action === "down") docker(["compose", "down"], env);
  else docker(["compose", "exec", "piarre", "codex", "login", "--device-auth"], env);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Piarre Docker could not start.");
  process.exitCode = 1;
} finally {
  if (publicConfig) rmSync(publicConfig, { recursive: true, force: true });
}
