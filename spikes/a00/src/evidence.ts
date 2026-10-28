import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { observationInputSchema, parseResult, type ExperimentResult, type Finding, type Manifest, type Observation, type ObservationInput } from './shared/evidence';

export class EvidenceWriter {
  readonly observations: Observation[] = [];
  private readonly started = performance.now();
  private pending: Promise<void> = Promise.resolve();
  constructor(readonly directory: string, readonly manifest: Manifest) {}
  record(input: ObservationInput): number {
    const event = { ...observationInputSchema.parse(input), sequence: this.observations.length + 1, elapsedMs: performance.now() - this.started };
    this.observations.push(event);
    this.pending = this.pending.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      await appendFile(join(this.directory, 'observations.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
    });
    return event.sequence;
  }
  async finalize(findings: Finding[]): Promise<ExperimentResult> {
    const result = parseResult({ schemaVersion: 1, manifest: this.manifest, observations: this.observations, findings });
    this.pending = this.pending.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = join(this.directory, 'result.json.tmp');
      await writeFile(temporary, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, join(this.directory, 'result.json'));
    });
    await this.pending;
    return result;
  }
  async flush(): Promise<void> { await this.pending; }
}

export async function readResult(path: string): Promise<ExperimentResult> { return parseResult(JSON.parse(await readFile(path, 'utf8'))); }
