import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { VIEWER_LIMITS } from '../../src/shared/artifact-viewer';

/** La aplicación externa recibe los bytes comprobados, nunca la ruta mutable original. */
export class ExternalArtifactCopies {
  private roots: string[] = [];
  private pending = 0;
  private generation = 0;
  async create(name: string, buffer: Buffer): Promise<string> {
    if (this.pending >= 2) throw new Error('Espera a que termine la apertura anterior.');
    this.pending++;
    const generation = this.generation;
    let root = '';
    try {
      if (this.roots.length >= VIEWER_LIMITS.tabs) {
        const oldest = this.roots[0];
        await fs.rm(oldest, { recursive: true, force: true });
        this.roots = this.roots.filter(value => value !== oldest);
      }
      root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-artifact-copy-'));
      await fs.chmod(root, 0o700);
      const file = path.join(root, path.basename(name));
      await fs.writeFile(file, buffer, { flag: 'wx', mode: 0o600 });
      if (generation !== this.generation) throw new Error('La sesión cambió.');
      this.roots.push(root);
      return file;
    } catch (error) { if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => {}); throw error; }
    finally { this.pending--; }
  }
  clear(): void {
    this.generation++;
    const roots = this.roots.splice(0);
    void Promise.allSettled(roots.map(root => fs.rm(root, { recursive: true, force: true })));
  }
}
