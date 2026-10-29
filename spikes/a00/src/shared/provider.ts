import { z } from 'zod';

export const voiceProviderSchema = z.enum(['mock', 'openai']);
export type VoiceProvider = z.infer<typeof voiceProviderSchema>;
export const voiceConfigurationSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('mock') }).strict(),
  z.object({ provider: z.literal('openai'), model: z.string().min(1) }).strict()
]);
export type VoiceConfiguration = z.infer<typeof voiceConfigurationSchema>;
export function parseVoiceConfiguration(input: unknown): Readonly<VoiceConfiguration> {
  return Object.freeze(voiceConfigurationSchema.parse(input));
}
