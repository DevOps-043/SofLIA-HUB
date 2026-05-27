import {
  CHARS_PER_TOKEN,
  FACTS_TOKEN_BUDGET,
  SEMANTIC_TOKEN_BUDGET,
  SUMMARY_TOKEN_BUDGET,
} from './constants';
import { truncateToTokens } from './math';
import type { MemoryContext } from './types';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function formatMemoryContextForPrompt(ctx: MemoryContext): string {
  let sections = '';

  if (ctx.soul) {
    sections += `\n\n=== SOUL (Core Persona) ===\n${truncateToTokens(ctx.soul, 500)}`;
  }

  if (ctx.identity) {
    sections += `\n\n=== IDENTITY (Current State) ===\n${truncateToTokens(ctx.identity, 500)}`;
  }

  if (ctx.memoryCards) {
    sections += `\n\n=== RECENT MEMORY CARDS ===\n${ctx.memoryCards}`;
  }

  if (ctx.recentMessages.length > 0) {
    let recentText = '';
    for (const message of ctx.recentMessages) {
      const time = new Date(message.timestamp).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const role = message.role === 'user' ? 'Usuario' : 'Asistente';
      recentText += `[${time}] ${role}: ${message.content}\n`;
    }

    if (recentText) {
      sections += `\n\n=== MENSAJES RECIENTES DE ESTA CONVERSACION ===\nEstos son los ultimos mensajes intercambiados con este usuario (persisten entre reinicios):\n${recentText}`;
    }
  }

  if (ctx.rollingSummary) {
    sections += `\n\n=== RESUMEN DE CONVERSACIONES ANTERIORES ===\n${truncateToTokens(
      ctx.rollingSummary,
      SUMMARY_TOKEN_BUDGET,
    )}`;
  }

  if (ctx.timelineRecall && ctx.timelineRecall.length > 0) {
    let timelineText = '';
    let tokenCount = 0;

    for (const recall of ctx.timelineRecall) {
      const date = new Date(recall.timestamp).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const role = recall.role === 'user' ? 'Usuario' : 'SofLIA';
      const entry = `[${date}] ${role}: ${recall.content}\n`;
      const entryTokens = estimateTokens(entry);
      if (tokenCount + entryTokens > SEMANTIC_TOKEN_BUDGET) break;
      timelineText += entry;
      tokenCount += entryTokens;
    }

    if (timelineText) {
      sections += `\n\n=== RECUERDOS FECHADOS DEL HISTORIAL WHATSAPP ===\nUsa estos fragmentos para responder preguntas sobre conversaciones pasadas. Si no son suficientes, dilo sin inventar.\n${timelineText}`;
    }
  }

  if (ctx.semanticRecall.length > 0) {
    let recallText = '';
    let tokenCount = 0;

    for (const recall of ctx.semanticRecall) {
      const date = new Date(recall.timestamp).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const entry = `[${date}] ${recall.text}\n---\n`;
      const entryTokens = estimateTokens(entry);
      if (tokenCount + entryTokens > SEMANTIC_TOKEN_BUDGET) break;
      recallText += entry;
      tokenCount += entryTokens;
    }

    if (recallText) {
      sections += `\n\n=== RECUERDOS RELEVANTES DE CONVERSACIONES PASADAS ===\n${recallText}`;
    }
  }

  if (ctx.facts.length > 0) {
    let factsText = '';
    let tokenCount = 0;

    for (const fact of ctx.facts) {
      const entry = `- [${fact.category}] ${fact.key}: ${fact.value}\n`;
      const entryTokens = estimateTokens(entry);
      if (tokenCount + entryTokens > FACTS_TOKEN_BUDGET) break;
      factsText += entry;
      tokenCount += entryTokens;
    }

    if (factsText) {
      sections += `\n\n=== DATOS CONOCIDOS DEL USUARIO ===\n${factsText}`;
    }
  }

  return sections;
}
