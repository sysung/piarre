import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function sourceRevision(root: string): Promise<string> {
  const digest = createHash('sha256');
  async function add(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await add(path);
      else if (entry.isFile()) { digest.update(relative(root, path)); digest.update('\0'); digest.update(await readFile(path)); digest.update('\0'); }
    }
  }
  await add(join(root, 'src'));
  await add(join(root, 'fixtures'));
  for (const filename of ['package.json', 'package-lock.json', 'build.mjs', 'tsconfig.base.json', 'tsconfig.host.json', 'tsconfig.webview.json']) { digest.update(filename); digest.update(await readFile(join(root, filename))); }
  return `source-sha256:${digest.digest('hex')}`;
}
