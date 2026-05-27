import { RECENT_MESSAGES_LIMIT } from './constants';
import { compactMemoryData, getMemoryStats } from './maintenance';
import { clearSessionResetMarker, getHistorySinceReset } from './reset-history';
import { migrateLegacyMemories } from './legacy-migration';
import type { MemoryMaintenanceApi, MemoryServiceConstructor } from './service-types';

export function attachMemoryMaintenance(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    async compactOldData(daysToKeep = 3650) {
      return compactMemoryData({
        db: this.db,
        daysToKeep,
        clearEmbeddingCache: () => this.embeddingCache.clear(),
      });
    },
    getStats(sessionKey?: string) {
      return getMemoryStats(this.db, sessionKey);
    },
    clearSessionContext(sessionKey: string) {
      clearSessionResetMarker(this.db, sessionKey);
    },
    getConversationHistorySinceReset(sessionKey: string, limit = RECENT_MESSAGES_LIMIT) {
      return getHistorySinceReset(this.db, sessionKey, limit);
    },
    migrateOldMemories() {
      migrateLegacyMemories((fact) => this.saveFact(fact));
    },
  } satisfies MemoryMaintenanceApi & ThisType<any>);
}
