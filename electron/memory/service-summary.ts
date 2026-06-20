import { SUMMARIZE_THRESHOLD } from './constants';
import { callGeminiMemorySummarizer, summarizeMemorySession } from './summary-runner';
import type { MemoryServiceConstructor, MemorySummaryApi } from './service-types';

export function attachMemorySummary(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    getLatestSummary(sessionKey: string) {
      if (!this.db) return null;
      try {
        const row = this.db.prepare('SELECT summary_text FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1').get(sessionKey) as { summary_text: string } | undefined;
        return row?.summary_text || null;
      } catch {
        return null;
      }
    },
    getRecentSummaries(sessionKey: string, limit: number) {
      if (!this.db) return [];
      try {
        const rows = this.db.prepare(`
          SELECT summary_text, period_start, period_end FROM summaries
          WHERE session_key = ? ORDER BY period_end DESC LIMIT ?
        `).all(sessionKey, limit) as Array<{ summary_text: string; period_start: number; period_end: number }>;
        return rows.reverse().map((row) => ({
          text: row.summary_text,
          periodStart: row.period_start,
          periodEnd: row.period_end,
        }));
      } catch {
        return [];
      }
    },
    checkSummarizationThreshold(sessionKey: string) {
      if (!this.db) return;
      try {
        const lastSummary = this.db.prepare('SELECT period_end FROM summaries WHERE session_key = ? ORDER BY period_end DESC LIMIT 1').get(sessionKey) as { period_end: number } | undefined;
        const count = this.db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_key = ? AND timestamp > ?').get(sessionKey, lastSummary?.period_end || 0) as { cnt: number };
        if (count.cnt >= SUMMARIZE_THRESHOLD) {
          this.summarizeQueue.add(sessionKey);
          this.processSummarizeQueueDebounced();
        }
      } catch (err: any) {
        console.error('[MemoryService] checkSummarizationThreshold error:', err.message);
      }
    },
    processSummarizeQueueDebounced() {
      if (this.summarizeTimer) return;
      this.summarizeTimer = setTimeout(() => {
        this.summarizeTimer = null;
        this.processSummarizeQueue();
      }, 5000);
    },
    async processSummarizeQueue() {
      if (this.isProcessingQueue || !this.apiKey || !this.db) return;
      this.isProcessingQueue = true;
      try {
        for (const sessionKey of this.summarizeQueue) {
          this.summarizeQueue.delete(sessionKey);
          await this.summarizeSession(sessionKey);
        }
      } catch (err: any) {
        console.error('[MemoryService] processSummarizeQueue error:', err.message);
      } finally {
        this.isProcessingQueue = false;
      }
    },
    summarizeSession(sessionKey: string) {
      return summarizeMemorySession(this, sessionKey);
    },
    callGeminiSummarize(conversationText: string) {
      return callGeminiMemorySummarizer(this.apiKey, conversationText);
    },
  } satisfies MemorySummaryApi & ThisType<any>);
}
