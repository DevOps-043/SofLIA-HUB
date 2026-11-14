import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { app } from 'electron';

type Mode = 'passive' | 'dictation';

/** Preferencia explícita de esta cuenta, independiente de enabled y de los grants activos. */
export class VoiceConsentStore {
  constructor(private readonly directory = path.join(app.getPath('userData'), 'voice-consents')) {}
  private file(userId: string): string {
    return path.join(this.directory, `${createHash('sha256').update(userId).digest('hex')}.json`);
  }
  allows(userId: string, signature: string, mode: Mode): boolean {
    try {
      const file = this.file(userId);
      if (fs.statSync(file).size > 16384) return false;
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      return saved.version === 1 && saved.signature === signature
        && (saved.mode === 'passive' || mode === 'dictation' && saved.mode === 'dictation');
    } catch { return false; }
  }
  remember(userId: string, signature: string, mode: Mode): void {
    fs.mkdirSync(this.directory, { recursive: true });
    const file = this.file(userId);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify({ version: 1, signature, mode }), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  forget(userId: string): void { fs.rmSync(this.file(userId), { force: true }); }
}
