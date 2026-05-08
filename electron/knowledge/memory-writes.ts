import path from 'node:path';
import fs from 'node:fs';
import {
  DAILY_DIR,
  DEFAULT_MEMORY,
  MEMORY_FILE,
} from './constants';
import { readFileContent } from './file-helpers';

export function saveMemoryEntry(content: string, section?: string): { success: boolean; message: string } {
  try {
    const current = readFileContent(MEMORY_FILE) || DEFAULT_MEMORY;
    const nextContent = section ? appendToSection(current, section, content) : `${current}\n- ${content}\n`;

    fs.writeFileSync(MEMORY_FILE, nextContent, 'utf-8');
    console.log(`[KnowledgeService] MEMORY.md updated: "${content.slice(0, 60)}..."`);
    return { success: true, message: 'Conocimiento guardado en MEMORY.md' };
  } catch (err: any) {
    console.error('[KnowledgeService] saveToMemory error:', err.message);
    return { success: false, message: err.message };
  }
}

export function rewriteMemoryFile(content: string): { success: boolean; message: string } {
  try {
    fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
    console.log('[KnowledgeService] MEMORY.md fully rewritten');
    return { success: true, message: 'MEMORY.md reescrito completamente.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function saveDailyLogEntry(content: string, phoneNumber?: string): { success: boolean; message: string } {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyFile = path.join(DAILY_DIR, `${today}.md`);
    const timestamp = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const prefix = phoneNumber ? `[${timestamp}] (${phoneNumber})` : `[${timestamp}]`;
    const entry = `${prefix} ${content}\n`;

    if (!fs.existsSync(dailyFile)) {
      fs.writeFileSync(dailyFile, `# Registro Diario - ${today}\n\n${entry}`, 'utf-8');
    } else {
      fs.appendFileSync(dailyFile, entry, 'utf-8');
    }
    return { success: true, message: 'Registrado en log diario.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export function appendToSection(currentContent: string, section: string, content: string): string {
  const sectionHeader = `## ${section}`;
  const sectionIndex = currentContent.indexOf(sectionHeader);
  if (sectionIndex === -1) return `${currentContent}\n## ${section}\n- ${content}\n`;

  const afterHeader = sectionIndex + sectionHeader.length;
  const nextSection = currentContent.indexOf('\n## ', afterHeader);
  const insertAt = nextSection !== -1 ? nextSection : currentContent.length;
  const before = currentContent.slice(0, insertAt);
  const after = currentContent.slice(insertAt);
  return `${before.trimEnd()}\n- ${content}\n${after}`;
}
