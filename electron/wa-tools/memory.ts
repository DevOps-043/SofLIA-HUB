import { CLIPBOARD_MEMORY_TOOLS } from './memory/clipboard-memory';
import { KNOWLEDGE_TOOLS } from './memory/knowledge';
import { LESSON_MEMORY_TOOLS } from './memory/lessons';

export const MEMORY_TOOLS = [
  ...LESSON_MEMORY_TOOLS,
  ...KNOWLEDGE_TOOLS,
  ...CLIPBOARD_MEMORY_TOOLS,
];
