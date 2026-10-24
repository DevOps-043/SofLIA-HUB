import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readPrivateFile(file: string, maxBytes: number): Promise<Buffer | null> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('Archivo de datos privados inválido.');
    const handle = await fs.open(file, 'r');
    try {
      const data = Buffer.alloc(maxBytes + 1);
      let total = 0;
      while (total < data.length) {
        const { bytesRead } = await handle.read(data, total, data.length - total, null);
        if (!bytesRead) break;
        total += bytesRead;
      }
      if (total > maxBytes) throw new Error('Archivo de datos privados excesivo.');
      return data.subarray(0, total);
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Reemplaza un archivo completo; el temporal sólo contiene bytes ya cifrados. */
export async function replacePrivateFile(file: string, data: Buffer, assert: () => void, maxBytes: number): Promise<void> {
  assert();
  if (data.length > maxBytes) throw new Error('Archivo de datos privados excesivo.');
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('Directorio de datos privados inválido.');
  const temporary = file + '.' + randomUUID() + '.tmp';
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close(); handle = undefined;
    assert();
    await fs.rename(temporary, file);
  } finally {
    await handle?.close();
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
