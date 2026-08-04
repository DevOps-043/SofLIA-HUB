/**
 * MemoryService — fachada del sistema de memoria de SofLIA.
 * Las capas raw, resúmenes, embeddings, facts y mantenimiento viven en ./memory/.
 */
import { EventEmitter } from 'node:events';
import { attachMemoryContext } from './memory/service-context';
import { attachMemoryEmbedding } from './memory/service-embedding';
import { attachMemoryFacts } from './memory/service-facts';
import { attachMemoryLifecycle } from './memory/service-lifecycle';
import { attachMemoryMaintenance } from './memory/service-maintenance';
import { attachMemoryMessages } from './memory/service-messages';
import { attachMemorySkills, type MemorySkillsApi } from './memory/skills-store';
import { attachMemorySummary } from './memory/service-summary';
import type {
  MemoryContextApi,
  MemoryEmbeddingApi,
  MemoryFactsApi,
  MemoryLifecycleApi,
  MemoryMaintenanceApi,
  MemoryMessageApi,
  MemorySummaryApi,
} from './memory/service-types';
import type { MemoryContext } from './memory/types';

export type { MemoryContext };

export class MemoryService extends EventEmitter {
  db: any | null = null;
  apiKey = '';
  summarizeQueue: Set<string> = new Set();
  isProcessingQueue = false;
  initError: string | null = null;
  summarizeTimer: NodeJS.Timeout | null = null;
  embeddingCache: Map<string, Array<{ id: number; embedding: number[]; startTime: number | null }>> = new Map();

  constructor() {
    super();
  }
}

export interface MemoryService
  extends MemoryLifecycleApi,
    MemoryMessageApi,
    MemoryContextApi,
    MemorySummaryApi,
    MemoryEmbeddingApi,
    MemoryFactsApi,
    MemorySkillsApi,
    MemoryMaintenanceApi {}

attachMemoryLifecycle(MemoryService);
attachMemoryMessages(MemoryService);
attachMemoryContext(MemoryService);
attachMemorySummary(MemoryService);
attachMemoryEmbedding(MemoryService);
attachMemoryFacts(MemoryService);
attachMemorySkills(MemoryService);
attachMemoryMaintenance(MemoryService);
