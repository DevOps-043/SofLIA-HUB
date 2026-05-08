import fs from 'node:fs';
import { OLD_MEMORIES_PATH } from './constants';

export function migrateLegacyMemories(saveFact: (fact: {
  phoneNumber: string | null;
  category: string;
  key: string;
  value: string;
  context?: string;
}) => void): void {
  try {
    if (!fs.existsSync(OLD_MEMORIES_PATH)) return;

    const data = JSON.parse(fs.readFileSync(OLD_MEMORIES_PATH, 'utf-8'));
    if (!Array.isArray(data) || data.length === 0) return;
    console.log(`[MemoryService] Migrating ${data.length} memories from whatsapp-memories.json`);

    for (const memory of data) {
      const lesson = memory.lesson || memory.text || '';
      if (!lesson.trim()) continue;
      const key = lesson
        .slice(0, 50)
        .replace(/[^a-zA-Z0-9áéíóúñ\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase();
      saveFact({
        phoneNumber: null,
        category: 'correction',
        key: key || `legacy_${Date.now()}`,
        value: lesson,
        context: memory.context || 'Migrado de whatsapp-memories.json',
      });
    }

    const backupPath = `${OLD_MEMORIES_PATH}.migrated`;
    fs.renameSync(OLD_MEMORIES_PATH, backupPath);
    console.log(`[MemoryService] Migration complete. Old file renamed to ${backupPath}`);
  } catch (err: any) {
    console.error('[MemoryService] Migration error:', err.message);
  }
}
