import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const [root, out] = process.argv.slice(2);
assert(root && out && path.isAbsolute(root) && path.isAbsolute(out), 'Provide absolute candidate and fresh evidence directory paths');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse','HEAD'), '2bf1d2f9ea168f5b8f9fb9230aa5925c62a03689');
assert.equal(git('status','--porcelain'), '');
assert(!existsSync(path.join(out,'attempts.jsonl')));
const suite = path.join(import.meta.dirname, 'suite.json');
assert.equal(createHash('sha256').update(readFileSync(suite)).digest('hex'), '8d7a8b4e0fdbba58ead4344079db93d70dbff5cc6e5f7712e30af8cd76f59a0f');
mkdirSync(out, { recursive:true });
copyFileSync(suite, path.join(out,'suite.json'));
const entries={
 'apps/vscode/src/conversation-controller.ts':['ConversationController'],
 'apps/vscode/src/conversation-context.ts':['resolveConversationContext'],
 'apps/vscode/src/sqlite-project-repository.ts':['SqliteProjectRepository'],
 'apps/vscode/src/docker-model-runner-conversation-client.ts':['DockerModelRunnerConversationClient','localDiscussionDefaults','parseLocalDiscussionConfiguration'],
 'packages/core/src/index.ts':['currentKnowledge','defaultSessionId'],
};
await build({stdin:{contents:Object.entries(entries).map(([file,names])=>`import {${names}} from ${JSON.stringify(path.join(root,file))};`).join('\n')+
 '\nimport host from '+JSON.stringify(path.join(import.meta.dirname,'host.cjs'))+';\nexport const run=host({'+Object.values(entries).flat().join(',')+'},'+JSON.stringify(out)+');',resolveDir:root},
 bundle:true,external:['vscode'],platform:'node',format:'cjs',target:'node22',outfile:path.join(out,'runner.cjs')});
console.log('Built isolated Extension Host evaluation. No inference was called.');
