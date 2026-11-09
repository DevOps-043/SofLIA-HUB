import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { PROJECT_UPLOAD_MAX_BYTES, PROJECT_UPLOAD_MAX_FILES, type ProjectUploadDeclaration } from '../../src/shared/project-hub-files';
import { ProjectFileContentValidator, projectFileMime } from './file-format';
const CHUNK_BYTES = 64 * 1024;
export class ProjectUploadFile {
  private constructor(private readonly handle: fs.FileHandle, readonly declaration: ProjectUploadDeclaration, readonly extension: string) {}

  static async open(file: string, assert: () => void): Promise<ProjectUploadFile> {
    assert(); const before = await fs.lstat(file); assert();
    const extension = path.extname(file).slice(1).toLowerCase(); const name = path.basename(file);
    const mime = projectFileMime(extension);
    if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > PROJECT_UPLOAD_MAX_BYTES
      || !mime || !name.trim() || name.length > 255 || [...name].some(char => char.charCodeAt(0) < 32)) throw new Error('Archivo no permitido.');
    const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const handle = await fs.open(file, flags);
    try {
      assert(); const stat = await handle.stat(); assert();
      if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== before.size) throw new Error('El archivo cambió.');
      const declaration = { name, mime_type: mime, size: stat.size, sha256: '' };
      const opened = new ProjectUploadFile(handle, declaration, extension);
      const { hash } = await opened.read(assert, false); declaration.sha256 = hash;
      return opened;
    } catch (error) { await handle.close(); throw error; }
  }
  async bytes(assert: () => void): Promise<Buffer> {
    const { hash, bytes } = await this.read(assert, true);
    if (hash !== this.declaration.sha256) throw new Error('El archivo aprobado cambió.');
    return bytes!;
  }
  close(): Promise<void> { return this.handle.close(); }
  private async read(assert: () => void, retain: boolean): Promise<{ hash: string; bytes?: Buffer }> {
    assert(); const stat = await this.handle.stat(); assert();
    if (!stat.isFile() || stat.size !== this.declaration.size) throw new Error('El archivo cambió de tamaño.');
    const hash = createHash('sha256'); const scratch = Buffer.alloc(CHUNK_BYTES); const chunks: Buffer[] = [];
    let total = 0;
    const content = new ProjectFileContentValidator(this.declaration.mime_type);
    while (true) {
      assert(); const { bytesRead } = await this.handle.read(scratch, 0, Math.min(CHUNK_BYTES, PROJECT_UPLOAD_MAX_BYTES + 1 - total), total); assert();
      if (!bytesRead) break;
      total += bytesRead;
      if (total > this.declaration.size || total > PROJECT_UPLOAD_MAX_BYTES) throw new Error('Archivo excesivo.');
      const bytes = scratch.subarray(0, bytesRead); hash.update(bytes);
      content.update(bytes);
      if (retain) chunks.push(Buffer.from(bytes));
    }
    content.finish(); assert();
    if (total !== this.declaration.size) throw new Error('Lectura parcial del archivo.');
    return { hash: hash.digest('hex'), ...(retain ? { bytes: Buffer.concat(chunks, total) } : {}) };
  }
}
export async function openProjectUploadFiles(paths: string[], assert: () => void): Promise<ProjectUploadFile[]> {
  if (!paths.length || paths.length > PROJECT_UPLOAD_MAX_FILES || new Set(paths).size !== paths.length) throw new Error('Selección inválida.');
  const files: ProjectUploadFile[] = [];
  try { for (const file of paths) files.push(await ProjectUploadFile.open(file, assert)); return files; }
  catch (error) { await Promise.allSettled(files.map(file => file.close())); throw error; }
}
