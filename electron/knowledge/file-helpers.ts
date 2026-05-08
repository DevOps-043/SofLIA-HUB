import fs from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE_DIR } from './constants';

export function readFileContent(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[... truncado por limite de contexto ...]`;
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

export function resolveKnowledgePath(fileName: string): string | null {
  const normalized = fileName.replace(/\\/g, '/').replace(/\.\./g, '');
  const candidates = [
    path.join(KNOWLEDGE_DIR, normalized),
    path.join(KNOWLEDGE_DIR, `${normalized}.md`),
  ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(KNOWLEDGE_DIR)) continue;
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}
