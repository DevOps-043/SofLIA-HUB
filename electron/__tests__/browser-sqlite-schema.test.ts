import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initializeBrowserSchema } from '../integrated-browser/sqlite-schema';
import { BrowserHistoryStore } from '../integrated-browser/browser-history-store';
import { BrowserAgentAuditStore } from '../integrated-browser/agent-audit-store';
import { BrowserSemanticMemoryStore } from '../integrated-browser/semantic-memory-store';
const roots: string[] = [];
function file() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-schema-')); roots.push(root); return path.join(root, 'store.sqlite'); }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
describe('migraciones SQLite del navegador', () => {
  it.each(['crear', 'validar'])('revierte una migración que falla al %s, permite reintentar y no repite una publicada', mode => {
    const destination = file(); const db = new DatabaseSync(destination);
    const create = () => db.exec('CREATE TABLE fixture(id TEXT); INSERT INTO fixture VALUES(\'dato\');');
    const validate = () => { expect(db.prepare('SELECT id FROM fixture').get()?.id).toBe('dato'); };
    try {
      expect(() => initializeBrowserSchema(db, () => { create(); if (mode === 'crear') throw new Error('Fallo simulado'); }, () => { if (mode === 'validar') throw new Error('Fallo simulado'); })).toThrow('simulado');
      expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(0);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='fixture'").get()).toBeUndefined();
      initializeBrowserSchema(db, create, validate);
      initializeBrowserSchema(db, () => { throw new Error('No debe repetirse'); }, validate);
      expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(1);
    } finally { db.close(); }
    const reopened = new DatabaseSync(destination);
    try { expect(reopened.prepare('SELECT id FROM fixture').get()?.id).toBe('dato'); } finally { reopened.close(); }
  });
  it.each([0, 1, 9])('los tres stores conservan una base ajena/incompleta de versión %s', async version => {
    for (const kind of ['history', 'audit', 'semantic']) {
      const destination = file(); const db = new DatabaseSync(destination);
      db.exec(`CREATE TABLE ajena(id TEXT); INSERT INTO ajena VALUES('conservar'); PRAGMA user_version=${version};`); db.close();
      const before = fs.readFileSync(destination);
      if (kind === 'history') { const store = new BrowserHistoryStore(destination, null); try { await expect(store.list()).rejects.toThrow(); } finally { await store.flushAndClose(); } }
      if (kind === 'audit') expect(() => new BrowserAgentAuditStore(destination).list()).toThrow();
      if (kind === 'semantic') expect(() => new BrowserSemanticMemoryStore().read(destination)).toThrow();
      expect(fs.readFileSync(destination)).toEqual(before);
    }
  });
});
