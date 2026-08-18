import { app } from 'electron';
import path from 'node:path';
import { SOFLIA_RUNTIME_MODEL } from '../../src/shared/soflia-runtime-model';

export const DB_PATH = path.join(app.getPath('userData'), 'soflia-memory.db');
export const OLD_MEMORIES_PATH = path.join(app.getPath('userData'), 'whatsapp-memories.json');
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_MODEL_FALLBACK = 'text-embedding-004';
export const SUMMARIZE_MODEL = SOFLIA_RUNTIME_MODEL;
export const CHUNK_TOKENS = 400;
export const CHUNK_OVERLAP = 80;
export const CHARS_PER_TOKEN = 4;
export const RECENT_MESSAGES_LIMIT = 30;
export const SEMANTIC_TOP_K = 10;
export const SEMANTIC_MIN_SCORE = 0.22;
export const SUMMARY_TOKEN_BUDGET = 3000;
export const SEMANTIC_TOKEN_BUDGET = 2500;
export const FACTS_TOKEN_BUDGET = 1800;
export const SKILLS_TOKEN_BUDGET = 1500;
export const SKILLS_IN_CONTEXT = 8;
export const SUMMARIZE_THRESHOLD = 15;
export const SUMMARIES_IN_CONTEXT = 5;
// El modelo de memoria razona antes de responder y esos tokens de pensamiento
// se descuentan de `maxOutputTokens`. Con topes ajustados el pensamiento se come
// el presupuesto entero y la respuesta llega truncada (MAX_TOKENS): el resumen
// queda en un fragmento inservible y la extraccion de hechos/skills recibe JSON
// partido. Estos topes dejan margen para pensamiento + respuesta completa.
export const SUMMARY_OUTPUT_TOKENS = 4000;
export const EXTRACTION_OUTPUT_TOKENS = 3000;
export const MEMORY_THINKING_LEVEL = 'low';
// Un resumen mas corto que esto no es una Memory Card: es un encabezado cortado.
// No se guarda para no envenenar el contexto que se inyecta en cada turno.
export const MIN_SUMMARY_CHARS = 150;
