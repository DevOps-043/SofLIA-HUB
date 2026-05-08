import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { updateIdentityFile, updateSoulFile } from './markdown-store';
import type { MemoryFactsApi, MemoryServiceConstructor } from './service-types';

export function attachMemoryFacts(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    saveFact(params) {
      if (!this.db) return { success: false, message: 'Database not initialized' };
      try {
        this.db.prepare(`
          INSERT INTO facts (phone_number, category, fact_key, fact_value, source_context, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(phone_number, category, fact_key) DO UPDATE SET
            fact_value = excluded.fact_value,
            source_context = excluded.source_context,
            updated_at = datetime('now'),
            confidence = 1.0
        `).run(params.phoneNumber, params.category, params.key, params.value, params.context || null);
        console.log(`[MemoryService] Fact saved: [${params.category}] ${params.key} = ${params.value}`);
        return { success: true, message: 'Dato guardado.' };
      } catch (err: any) {
        console.error('[MemoryService] saveFact error:', err.message);
        return { success: false, message: err.message };
      }
    },
    getFacts(phoneNumber: string) {
      if (!this.db) return [];
      try {
        const rows = this.db.prepare(`
          SELECT fact_key, fact_value, category FROM facts
          WHERE phone_number = ? OR phone_number IS NULL
          ORDER BY updated_at DESC
          LIMIT 50
        `).all(phoneNumber) as Array<{ fact_key: string; fact_value: string; category: string }>;
        return rows.map((row) => ({ key: row.fact_key, value: row.fact_value, category: row.category }));
      } catch (err: any) {
        console.error('[MemoryService] getFacts error:', err.message);
        return [];
      }
    },
    deleteFact(factId: number) {
      if (!this.db) return false;
      try {
        this.db.prepare('DELETE FROM facts WHERE id = ?').run(factId);
        return true;
      } catch {
        return false;
      }
    },
    updateSoul(content: string) {
      updateSoulFile(content);
    },
    updateIdentity(content: string) {
      updateIdentityFile(content);
    },
    appendMemoryCard(sessionKey: string, summary: string) {
      const memoryPath = path.join(app.getPath('userData'), 'MEMORY.md');
      try {
        const timestamp = new Date().toLocaleString('es-MX');
        const card = `\n\n### Memory Card: Sesión ${sessionKey}\n**Fecha:** ${timestamp}\n\n${summary}\n\n---`;
        fs.appendFileSync(memoryPath, card, 'utf8');
        console.log('[MemoryService] Memory Card appended to MEMORY.md');
      } catch (err: any) {
        console.error('[MemoryService] appendMemoryCard error:', err.message);
      }
    },
  } satisfies MemoryFactsApi & ThisType<any>);
}
