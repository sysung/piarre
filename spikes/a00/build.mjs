import { build } from 'esbuild';

await build({ entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist/extension.cjs', external: ['vscode'], sourcemap: true });
await build({ entryPoints: ['src/webview/voice.ts'], bundle: true, platform: 'browser', format: 'iife', outfile: 'dist/voice.js', sourcemap: true });
