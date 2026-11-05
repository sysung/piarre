const secretName = /(?:secret|credential|private[-_]?key|token|password)/i;
const excludedDirectories = new Set(["node_modules", "vendor", "dist", "dist-test", "dist-package", "coverage", "build"]);
const supportedExtensions = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "md", "json", "yaml", "yml", "toml", "tf", "sql", "py"]);
const safeSkillName = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function portableContextPath(relative: string, nativeSeparator: string): string {
  return relative.split(nativeSeparator).join("/");
}

function segments(relative: string): readonly string[] | undefined {
  if (!relative || relative.includes("\\") || relative.includes(":") || Array.from(relative).some(character => character.charCodeAt(0) < 32)) return;
  const parts = relative.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || secretName.test(part))) return;
  return parts;
}

function ordinary(parts: readonly string[]): boolean {
  return parts.every(part => !part.startsWith(".") && !excludedDirectories.has(part));
}

export function isRepositorySkillPath(relative: string): boolean {
  const parts = segments(relative);
  if (!parts || parts.at(-1) !== "SKILL.md") return false;
  return ordinary(parts) || (parts.length === 4 && parts[0] === ".agents" && parts[1] === "skills" && safeSkillName.test(parts[2] ?? ""));
}

export function isEligibleContextPath(relative: string): boolean {
  const parts = segments(relative);
  if (!parts) return false;
  if (isRepositorySkillPath(relative)) return true;
  const extension = parts.at(-1)?.split(".").at(-1)?.toLowerCase() ?? "";
  return ordinary(parts) && supportedExtensions.has(extension) && (parts.at(-1)?.includes(".") ?? false);
}

export function isEligibleContextDirectory(relative: string): boolean {
  const parts = segments(relative);
  if (!parts) return false;
  return ordinary(parts) || (parts[0] === ".agents" && (parts.length === 1 ||
    (parts[1] === "skills" && (parts.length === 2 || (parts.length === 3 && safeSkillName.test(parts[2] ?? ""))))));
}
