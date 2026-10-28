import { z } from 'zod';
import { observationInputSchema, safeText, scenarioSchema } from './shared/evidence';

const trial = z.number().int().positive();
export const webviewMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready') }).strict(),
  z.object({ kind: z.literal('session-request'), requestId: z.number().int().positive(), scenario: scenarioSchema, trial }).strict(),
  z.object({ kind: z.literal('session-abort'), requestId: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('observe'), observation: observationInputSchema }).strict(),
  z.object({ kind: z.literal('finding'), scenario: scenarioSchema, outcome: z.enum(['verified', 'unsupported', 'failed', 'blocked', 'not-tested']), note: safeText.min(1), trials: z.array(trial).max(2) }).strict()
]);
export function parseWebviewMessage(input: unknown): z.infer<typeof webviewMessageSchema> { return webviewMessageSchema.parse(input); }
