import { app, safeStorage } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from './constants';
import { getDatabaseConstructor } from './database';
import { SCHEMA_SQL } from './schema';

const DEFAULT_SOUL = `# SofLIA - Identidad Central

## Quien Soy
Soy SofLIA, asistente de IA para negocios hispanohablantes. Mi mision es ejecutar tareas, no solo responder preguntas.

## Principios
- EJECUTO acciones directamente usando herramientas - no describo lo que haria
- RECUERDO conversaciones anteriores usando mi sistema de memoria persistente
- Cuando el usuario dice "vuelve a hacerlo" o "sigue", reviso mis mensajes recientes y continuo la tarea
- NUNCA digo "no se de que hablas" si tengo contexto previo disponible
- Para tareas grandes (organizar correos, mover archivos), proceso TODOS los items, no solo los primeros

## Personalidad
- Proactiva, eficiente, directa
- Respondo en espanol
- Formato WhatsApp (texto plano, *negritas*, emojis)
`;

function resolveDatabaseKey(keyPath: string): string {
  if (fs.existsSync(keyPath)) {
    const encryptedKey = fs.readFileSync(keyPath);
    if (!safeStorage.isEncryptionAvailable()) {
      return encryptedKey.toString('utf8');
    }
    try {
      return safeStorage.decryptString(encryptedKey);
    } catch {
      console.warn('[MemoryService] Fallback to unencrypted DB key');
      return encryptedKey.toString('utf8');
    }
  }

  const dbKey = crypto.randomBytes(32).toString('hex');
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(keyPath, safeStorage.encryptString(dbKey));
  } else {
    fs.writeFileSync(keyPath, dbKey, 'utf8');
  }
  return dbKey;
}

function ensureDefaultSoulFile(): void {
  const soulPath = path.join(app.getPath('userData'), 'SOUL.md');
  if (fs.existsSync(soulPath)) {
    return;
  }
  fs.writeFileSync(soulPath, DEFAULT_SOUL, 'utf-8');
  console.log('[MemoryService] Created default SOUL.md');
}

export function initializeMemoryDatabase(): { db: any | null; initError: string | null } {
  try {
    const DatabaseCtor = getDatabaseConstructor();
    const db = new DatabaseCtor(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma(`key = '${resolveDatabaseKey(path.join(app.getPath('userData'), 'soflia-memory.key'))}'`);
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
    console.log(`[MemoryService] Database initialized at ${DB_PATH}`);
    ensureDefaultSoulFile();
    return { db, initError: null };
  } catch (err: any) {
    console.error('[MemoryService] Failed to initialize database:', err.message);
    return { db: null, initError: err.message };
  }
}
