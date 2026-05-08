import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function updateSoulFile(content: string): void {
  const soulPath = path.join(app.getPath('userData'), 'SOUL.md');
  try {
    fs.writeFileSync(soulPath, content, 'utf8');
    console.log('[MemoryService] SOUL.md updated');
  } catch (err: any) {
    console.error('[MemoryService] updateSoul error:', err.message);
  }
}

export function updateIdentityFile(content: string): void {
  const identityPath = path.join(app.getPath('userData'), 'IDENTITY.md');
  try {
    fs.writeFileSync(identityPath, content, 'utf8');
    console.log('[MemoryService] IDENTITY.md updated');
  } catch (err: any) {
    console.error('[MemoryService] updateIdentity error:', err.message);
  }
}

export function appendMemoryCardFile(sessionKey: string, summary: string): void {
  const memoryPath = path.join(app.getPath('userData'), 'MEMORY.md');
  try {
    const timestamp = new Date().toLocaleString('es-MX');
    const card = `\n\n### Memory Card: Sesion ${sessionKey}\n**Fecha:** ${timestamp}\n\n${summary}\n\n---`;
    fs.appendFileSync(memoryPath, card, 'utf8');
    console.log('[MemoryService] Memory Card appended to MEMORY.md');
  } catch (err: any) {
    console.error('[MemoryService] appendMemoryCard error:', err.message);
  }
}
