import { app } from 'electron';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { systemCipher } from '../storage/os-cipher';
import { readPrivateFile, replacePrivateFile } from '../storage/private-files';

const MAX_BYTES = 4096;
const writes = new Map<string, Promise<void>>();

function preferencePath(userId: string): string {
  const account = createHash('sha256').update(userId).digest('hex');
  return path.join(app.getPath('userData'), 'computer-permissions', `${account}.enc`);
}

export async function readFullComputerAccess(userId: string): Promise<boolean> {
  const file = preferencePath(userId);
  try {
    await writes.get(file)?.catch(() => undefined);
    const data = await readPrivateFile(file, MAX_BYTES);
    if (!data || !await systemCipher.available()) return false;
    const { result } = await systemCipher.decrypt(data);
    return result === JSON.stringify({ version: 1, userId, mode: 'full' });
  } catch { return false; }
}

export async function saveFullComputerAccess(userId: string, full: boolean, assert: () => void): Promise<void> {
  const file = preferencePath(userId);
  const pending = (writes.get(file)?.catch(() => undefined) ?? Promise.resolve()).then(async () => {
    assert();
    if (!full) { await rm(file, { force: true }); return; }
    if (!await systemCipher.available()) throw new Error('El almacenamiento seguro no está disponible.');
    const data = await systemCipher.encrypt(JSON.stringify({ version: 1, userId, mode: 'full' }));
    await replacePrivateFile(file, data, assert, MAX_BYTES);
  });
  writes.set(file, pending);
  try { await pending; }
  finally { if (writes.get(file) === pending) writes.delete(file); }
}
