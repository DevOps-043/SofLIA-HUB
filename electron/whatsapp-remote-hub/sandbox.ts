import { z } from 'zod';

export const blockedRegexes = [
  /(rm\s+-rf|del\s+\/|format\s+)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /chmod\s+-R\s+777/i,
  /chown\s+-R\s+/i,
  /sudo\s+rm/i,
  />\s*\/dev\/sd/i,
];

export const CommandInputSchema = z.object({
  text: z.string().min(1).refine(
    (value) => blockedRegexes.every((regex) => !regex.test(value)),
    { message: 'Comando bloqueado: Patron peligroso detectado.' },
  ),
  jid: z.string(),
  messageId: z.string().optional(),
});

export type CommandInput = z.infer<typeof CommandInputSchema>;

export class SandboxGatekeeper {
  static validate(input: unknown) {
    return CommandInputSchema.safeParse(input);
  }
}
