import path from 'node:path';
import { createHash } from 'node:crypto';
import { readPrivateFile, replacePrivateFile } from '../storage/private-files';
import { systemCipher, type OsCipher } from '../storage/os-cipher';

const MAX_BYTES = 128 * 1024;
/** Las rutas privadas no viajan a IRIS ni se escriben en el manifiesto portable. */
export class ProjectLocationStore {
  constructor(private readonly directory: string, private readonly cipher: OsCipher = systemCipher) {}
  private file(userId: string, key: string) {
    const owner = createHash('sha256').update(userId).digest('hex');
    const record = createHash('sha256').update(key).digest('hex');
    return path.join(this.directory, owner, `${record}.enc`);
  }
  async read(userId: string, key: string, assert: () => void): Promise<unknown> {
    assert();
    const bytes = await readPrivateFile(this.file(userId, key), MAX_BYTES);
    assert();
    if (!bytes) return null;
    if (!await this.cipher.available()) throw new Error('El almacenamiento seguro del equipo no está disponible.');
    const decoded = JSON.parse((await this.cipher.decrypt(bytes)).result) as { userId?: unknown; value?: unknown };
    assert();
    if (decoded.userId !== userId) throw new Error('La ubicación pertenece a otra sesión.');
    return decoded.value;
  }
  async write(userId: string, key: string, value: unknown, assert: () => void) {
    assert();
    if (!await this.cipher.available()) throw new Error('El almacenamiento seguro del equipo no está disponible.');
    const bytes = await this.cipher.encrypt(JSON.stringify({ userId, value }));
    await replacePrivateFile(this.file(userId, key), bytes, assert, MAX_BYTES);
  }
}
