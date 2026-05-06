/**
 * Almacenamiento persistente de sesiones de WhatsApp autenticadas.
 *
 * Persiste en JSON dentro de `userData/whatsapp-iris-sessions.json` para
 * sobrevivir reinicios. Se carga al arrancar el módulo. Las mutaciones
 * (`setSession`, `removeSession`) escriben a disco inmediatamente.
 */

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { WhatsAppSession } from './types';

const WA_AUTH_PATH = path.join(app.getPath('userData'), 'whatsapp-iris-sessions.json');

let sessions: Map<string, WhatsAppSession> = new Map();

function loadSessions(): void {
  try {
    if (fs.existsSync(WA_AUTH_PATH)) {
      const data = JSON.parse(fs.readFileSync(WA_AUTH_PATH, 'utf-8'));
      sessions = new Map(Object.entries(data));
    }
  } catch {
    sessions = new Map();
  }
}

function saveSessions(): void {
  const obj: Record<string, WhatsAppSession> = {};
  sessions.forEach((value, key) => {
    obj[key] = value;
  });
  fs.writeFileSync(WA_AUTH_PATH, JSON.stringify(obj, null, 2), 'utf-8');
}

// Carga única al importar el módulo (idempotente: si la app reinicia, recarga).
loadSessions();

export function getSession(phoneNumber: string): WhatsAppSession | null {
  return sessions.get(phoneNumber) || null;
}

export function setSession(session: WhatsAppSession): void {
  sessions.set(session.phoneNumber, session);
  saveSessions();
}

export function removeSession(phoneNumber: string): boolean {
  const deleted = sessions.delete(phoneNumber);
  if (deleted) saveSessions();
  return deleted;
}

export function getAllSessions(): WhatsAppSession[] {
  return Array.from(sessions.values());
}
