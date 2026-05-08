import fs from 'node:fs';
import { getBootstrapKnowledgeContext } from './knowledge/bootstrap-context';
import {
  DAILY_DIR,
  DEFAULT_MEMORY,
  KNOWLEDGE_DIR,
  MEMORY_FILE,
  USERS_DIR,
} from './knowledge/constants';
import { readKnowledgeFileContent, searchKnowledgeFiles, listKnowledgeFiles } from './knowledge/file-operations';
import { rewriteMemoryFile, saveDailyLogEntry, saveMemoryEntry } from './knowledge/memory-writes';
import { getUserProfileContent, updateKnowledgeUserProfile } from './knowledge/user-profile';

export class KnowledgeService {
  private initialized = false;

  init(): void {
    try {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      fs.mkdirSync(USERS_DIR, { recursive: true });
      fs.mkdirSync(DAILY_DIR, { recursive: true });
      if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(MEMORY_FILE, DEFAULT_MEMORY, 'utf-8');
        console.log('[KnowledgeService] Created default MEMORY.md');
      }
      this.initialized = true;
      console.log(`[KnowledgeService] Initialized at ${KNOWLEDGE_DIR}`);
    } catch (err: any) {
      console.error('[KnowledgeService] Init error:', err.message);
    }
  }

  getBootstrapContext(phoneNumber: string): string {
    if (!this.initialized) return '';
    return getBootstrapKnowledgeContext(phoneNumber, (phone) => this.getUserProfile(phone));
  }

  saveToMemory(content: string, section?: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };
    return saveMemoryEntry(content, section);
  }

  rewriteMemory(content: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };
    return rewriteMemoryFile(content);
  }

  saveToDailyLog(content: string, phoneNumber?: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };
    return saveDailyLogEntry(content, phoneNumber);
  }

  updateUserProfile(phoneNumber: string, section: string, content: string): { success: boolean; message: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };
    return updateKnowledgeUserProfile(phoneNumber, section, content);
  }

  getUserProfile(phoneNumber: string): string | null {
    return getUserProfileContent(phoneNumber);
  }

  readKnowledgeFile(fileName: string): { success: boolean; content?: string; message?: string } {
    if (!this.initialized) return { success: false, message: 'KnowledgeService not initialized' };
    return readKnowledgeFileContent(fileName);
  }

  searchKnowledge(query: string, maxResults: number = 10) {
    if (!this.initialized) return [];
    return searchKnowledgeFiles(query, maxResults);
  }

  listFiles() {
    if (!this.initialized) return [];
    return listKnowledgeFiles();
  }

  autoFlush(phoneNumber: string, contextSummary: string): void {
    if (!contextSummary.trim()) return;
    this.saveToDailyLog(contextSummary, phoneNumber);
  }
}
