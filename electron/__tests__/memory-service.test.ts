import { afterEach, beforeEach, describe } from 'vitest';
import { createTestDb } from './memory-service.fixtures';
import { registerMemoryContextCases } from './memory-service/context-cases';
import { registerMemoryFinalCases } from './memory-service/final-cases';
import { registerMemoryMaintenanceCases } from './memory-service/maintenance-cases';
import { registerMemorySchemaCases } from './memory-service/schema-cases';
import { registerMemorySemanticCases } from './memory-service/semantic-cases';
import { registerMemoryStorageCases } from './memory-service/storage-cases';

describe('MemoryService', () => {
  let db: any;
  const ctx = { getDb: () => db };

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  registerMemorySchemaCases(ctx);
  registerMemoryStorageCases(ctx);
  registerMemorySemanticCases();
  registerMemoryMaintenanceCases(ctx);
  registerMemoryContextCases(ctx);
  registerMemoryFinalCases(ctx);
});
