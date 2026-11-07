import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { PYTHON_TOOLS_MAX_FILE_BYTES } from '../../src/shared/python-tools';
import { PythonToolsError } from './tools-error';

const CHUNK = 64 * 1024;
const EXTENSIONS = new Set(['.pdf', '.xlsx', '.xlsm', '.pptx', '.docx']);
/** Copia privada de la selección main; nunca elimina ni cambia el archivo original. */
export async function snapshotSelectedDocument(file: string, temporaryRoot: string, assert: () => void) {
  assert();
  const extension = path.extname(file).toLowerCase();
  if (!path.isAbsolute(file) || file.startsWith('\\\\') || file.startsWith('//') || !EXTENSIONS.has(extension)) throw new Error('TOOLS_INVALID_INPUT');
  const before = await fs.lstat(file); assert();
  if (!before.isFile() || before.isSymbolicLink() || before.size < 4 || before.size > PYTHON_TOOLS_MAX_FILE_BYTES) throw new Error('DOCUMENT_NOT_ALLOWED');
  const source = await fs.open(file, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK));
  let folder: string | undefined; let target: string | undefined; let owned = false; let sourceClosed = false;
  const remove = async () => { if (owned && target) { await fs.unlink(target); owned = false; } if (folder) { await fs.rmdir(folder); folder = undefined; } };
  try {
    const opened = await source.stat(); assert();
    const stable = async () => {
      const stat = await source.stat(); assert();
      if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== before.size
        || stat.mtimeMs !== before.mtimeMs || stat.ctimeMs !== before.ctimeMs) throw new Error('DOCUMENT_CHANGED');
    };
    if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error('DOCUMENT_CHANGED');
    await stable(); folder = await fs.mkdtemp(path.join(temporaryRoot, 'soflia-document-')); assert();
    await fs.chmod(folder, 0o700); assert(); target = path.join(folder, `document${extension}`);
    const output = await fs.open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600); owned = true;
    const hash = createHash('sha256'); const bytes = Buffer.alloc(CHUNK); let total = 0;
    try {
      while (true) {
        assert(); const { bytesRead } = await source.read(bytes, 0, Math.min(CHUNK, PYTHON_TOOLS_MAX_FILE_BYTES + 1 - total), total); assert();
        if (!bytesRead) break;
        if (!total && !(extension === '.pdf' ? bytes.subarray(0, 4).equals(Buffer.from('%PDF')) : bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4])))) throw new Error('DOCUMENT_NOT_ALLOWED');
        if (total + bytesRead > before.size || total + bytesRead > PYTHON_TOOLS_MAX_FILE_BYTES) throw new Error('DOCUMENT_CHANGED');
        hash.update(bytes.subarray(0, bytesRead)); let written = 0;
        while (written < bytesRead) { assert(); const part = await output.write(bytes, written, bytesRead - written, total + written); assert(); if (!part.bytesWritten) throw new Error('DOCUMENT_COPY_FAILED'); written += part.bytesWritten; }
        total += bytesRead;
      }
      if (total !== before.size) throw new Error('DOCUMENT_CHANGED');
      await output.sync(); assert();
    } finally { await output.close(); }
    await stable(); const copied = hash.digest('hex'); const check = createHash('sha256'); let position = 0;
    while (position < total) { assert(); const read = await source.read(bytes, 0, Math.min(CHUNK, total - position), position); assert(); if (!read.bytesRead) throw new Error('DOCUMENT_CHANGED'); check.update(bytes.subarray(0, read.bytesRead)); position += read.bytesRead; }
    await stable(); if (copied !== check.digest('hex')) throw new Error('DOCUMENT_CHANGED');
    await source.close(); sourceClosed = true; assert();
    return { path: target, size: total, remove };
  } catch (error) {
    try { await remove(); } catch { throw new PythonToolsError('DOCUMENT_CLEANUP_PENDING', error); }
    throw error;
  } finally { if (!sourceClosed) await source.close(); }
}
