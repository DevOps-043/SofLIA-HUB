import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { AgentRun, AgentScope } from '../../src/shared/agent-runtime';
import { AGENT_LIMITS } from '../../src/shared/agent-runtime';
import type { RunRepository } from './contracts';
import { sameScope } from './contracts';
import { z } from 'zod';
import { storedRunSchema } from './schemas';

export interface StateCipher {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}
export class EncryptedRunRepository implements RunRepository {
  constructor(private readonly directory: string, private readonly cipher: StateCipher) {}
  get encrypted(): boolean { return this.cipher.isEncryptionAvailable(); }
  private file(scope: AgentScope): string {
    return path.join(this.directory, createHash('sha256').update(JSON.stringify(scope)).digest('hex') + '.bin');
  }
  load(scope: AgentScope): AgentRun[] {
    if (!this.encrypted || !fs.existsSync(this.file(scope))) return [];
    const stat = fs.statSync(this.file(scope));
    if (stat.size > 8_000_000) throw new Error('El historial local excede el límite.');
    const parsed: unknown = JSON.parse(this.cipher.decryptString(fs.readFileSync(this.file(scope))));
    const result = z.array(storedRunSchema).max(AGENT_LIMITS.historyRuns).safeParse(parsed);
    if (!result.success || result.data.some(run => !sameScope(run.scope, scope))) throw new Error('No se pudo validar el historial cifrado.');
    return result.data;
  }
  save(scope: AgentScope, runs: AgentRun[]): void {
    if (!this.encrypted) return;
    fs.mkdirSync(this.directory, { recursive: true });
    const target = this.file(scope);
    const temporary = target + '.' + randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temporary, this.cipher.encryptString(JSON.stringify(runs.slice(-AGENT_LIMITS.historyRuns))), { mode: 0o600 });
      fs.renameSync(temporary, target);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}
