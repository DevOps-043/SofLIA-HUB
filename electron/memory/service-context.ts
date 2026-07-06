import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  RECENT_MESSAGES_LIMIT,
  SEMANTIC_TOP_K,
  SKILLS_IN_CONTEXT,
  SUMMARIES_IN_CONTEXT,
} from './constants';
import { buildTimelineRecall } from './timeline-recall';
import { phoneOwnerKey } from './scope';
import { parseRecipe } from './skills-executable';
import type { MemoryContextApi, MemoryServiceConstructor } from './service-types';
import type { MemoryContext } from './types';

export function attachMemoryContext(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    async assembleContext(sessionKey: string, phoneNumber: string, currentMessage: string, ownerKey?: string): Promise<MemoryContext> {
      const context: MemoryContext = { recentMessages: [], rollingSummary: null, semanticRecall: [], timelineRecall: [], facts: [], skills: [] };
      if (!this.db) return context;

      const recent = this.getRecentMessages(sessionKey, RECENT_MESSAGES_LIMIT);
      context.recentMessages = recent.map((message: any) => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      }));

      // Múltiples resúmenes cronológicos en lugar de solo el último
      const summaries = this.getRecentSummaries(sessionKey, SUMMARIES_IN_CONTEXT);
      context.rollingSummary = summaries.length > 0 ? formatMultipleSummaries(summaries) : null;

      context.timelineRecall = buildTimelineRecall(this.db, sessionKey, currentMessage, 30);
      if (this.apiKey && currentMessage.trim().length > 10) {
        try {
          const queryEmbedding = await this.embedText(currentMessage);
          if (queryEmbedding) context.semanticRecall = this.semanticSearch(sessionKey, phoneNumber, queryEmbedding, SEMANTIC_TOP_K);
        } catch (err: any) {
          console.warn('[MemoryService] Semantic search failed:', err.message);
        }
      }
      context.facts = this.getFacts(phoneNumber);
      // Skills aprendidas del owner: si no llega ownerKey (aun sin cablear la
      // superficie), se deriva del telefono (aislado) para no romper WhatsApp.
      const resolvedOwnerKey = ownerKey || phoneOwnerKey(phoneNumber);
      context.skills = this.getRelevantSkills(resolvedOwnerKey, SKILLS_IN_CONTEXT)
        .map((skill: { type: string; title: string; content: string }) => ({ type: skill.type, title: skill.title, content: skill.content }));
      // Procedimientos ejecutables: título + resumen legible (nunca el JSON interno).
      context.executableSkills = this.getExecutableSkills(resolvedOwnerKey)
        .map((skill: { title: string; content: string }) => ({ title: skill.title, summary: parseRecipe(skill.content)?.summary || '' }))
        .filter((entry: { title: string; summary: string }) => entry.summary);
      readMarkdownMemory(context);
      return context;
    },
  } satisfies MemoryContextApi & ThisType<any>);
}

function formatMultipleSummaries(summaries: Array<{ text: string; periodStart: number; periodEnd: number }>): string {
  return summaries.map((s) => {
    const fmt = (ts: number) => new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    const startLabel = fmt(s.periodStart);
    const endLabel = fmt(s.periodEnd);
    const dateLabel = startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
    return `[${dateLabel}]\n${s.text}`;
  }).join('\n\n');
}

function readMarkdownMemory(context: MemoryContext): void {
  try {
    const userData = app.getPath('userData');
    const soulPath = path.join(userData, 'SOUL.md');
    const identityPath = path.join(userData, 'IDENTITY.md');
    if (fs.existsSync(soulPath)) context.soul = fs.readFileSync(soulPath, 'utf8');
    if (fs.existsSync(identityPath)) context.identity = fs.readFileSync(identityPath, 'utf8');
  } catch (err: any) {
    console.warn('[MemoryService] Could not read markdown memory files:', err.message);
  }
}
