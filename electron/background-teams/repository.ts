import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { BackgroundJob, BackgroundScope } from '../../src/shared/background-teams';
import { BACKGROUND_LIMITS, sameBackgroundScope } from '../../src/shared/background-teams';
import type { StateCipher } from '../agent-runtime/repository';
import { storedJobSchema } from './schemas';

export class BackgroundRepository {
  constructor(readonly root: string, private readonly cipher: StateCipher) {}
  private key(scope: BackgroundScope): string { return createHash('sha256').update(JSON.stringify([scope.userId, scope.organizationId, scope.dataUserId])).digest('hex'); }
  folder(scope: BackgroundScope, jobId: string): string {
    if (!z.string().uuid().safeParse(jobId).success) throw new Error('Trabajo inválido.');
    return path.join(this.root, this.key(scope), 'artifacts', jobId);
  }
  private statePath(scope: BackgroundScope) { return path.join(this.root, this.key(scope), 'jobs.bin'); }
  private requireEncryption(): void {
    if (!this.cipher.isEncryptionAvailable()) throw new Error('El historial de trabajos necesita cifrado del sistema.');
  }
  load(scope: BackgroundScope): BackgroundJob[] {
    this.requireEncryption();
    const file = this.statePath(scope);
    if (!fs.existsSync(file)) return [];
    if (fs.statSync(file).size > 12_000_000) throw new Error('Historial de trabajos demasiado grande.');
    const jobs = z.array(storedJobSchema).max(BACKGROUND_LIMITS.history).parse(JSON.parse(this.cipher.decryptString(fs.readFileSync(file))));
    if (jobs.some(job => !sameBackgroundScope(job.scope, scope))) throw new Error('Historial fuera de alcance.');
    return jobs;
  }
  save(scope: BackgroundScope, jobs: BackgroundJob[]): void {
    this.requireEncryption();
    const validated = z.array(storedJobSchema).max(BACKGROUND_LIMITS.history).parse(jobs);
    if (validated.some(job => !sameBackgroundScope(job.scope, scope))) throw new Error('Trabajo fuera de alcance.');
    const file = this.statePath(scope);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + '.' + randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temporary, this.cipher.encryptString(JSON.stringify(validated)), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
}

