import { app } from 'electron';
import path from 'node:path';

export const DB_PATH = path.join(app.getPath('userData'), 'soflia-memory.db');
export const OLD_MEMORIES_PATH = path.join(app.getPath('userData'), 'whatsapp-memories.json');
export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_MODEL_FALLBACK = 'text-embedding-004';
export const SUMMARIZE_MODEL = 'gemini-3-flash-preview';
export const CHUNK_TOKENS = 400;
export const CHUNK_OVERLAP = 80;
export const CHARS_PER_TOKEN = 4;
export const RECENT_MESSAGES_LIMIT = 30;
export const SEMANTIC_TOP_K = 5;
export const SEMANTIC_MIN_SCORE = 0.30;
export const SUMMARY_TOKEN_BUDGET = 2000;
export const SEMANTIC_TOKEN_BUDGET = 2000;
export const FACTS_TOKEN_BUDGET = 1000;
export const SUMMARIZE_THRESHOLD = 15;
