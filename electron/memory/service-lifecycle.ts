import { initializeMemoryDatabase } from './initializer';
import { formatMemoryContextForPrompt } from './context-formatter';
import { deleteMemoryToken, getMemoryToken, saveMemoryToken } from './token-store';
import type { MemoryServiceConstructor, MemoryLifecycleApi } from './service-types';

export function attachMemoryLifecycle(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    init() {
      const result = initializeMemoryDatabase();
      this.db = result.db;
      this.initError = result.initError;
      if (this.db) this.migrateOldMemories();
    },
    setApiKey(key: string) {
      this.apiKey = key;
    },
    close() {
      if (!this.db) return;
      this.db.close();
      this.db = null;
      console.log('[MemoryService] Database closed');
    },
    getInitError() {
      return this.initError;
    },
    saveToken(serviceName: string, token: string) {
      saveMemoryToken(serviceName, token);
    },
    getToken(serviceName: string) {
      return getMemoryToken(serviceName);
    },
    deleteToken(serviceName: string) {
      return deleteMemoryToken(serviceName);
    },
    formatContextForPrompt(ctx) {
      return formatMemoryContextForPrompt(ctx);
    },
  } satisfies MemoryLifecycleApi & ThisType<any>);
}
