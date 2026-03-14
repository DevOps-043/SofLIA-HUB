/**
 * AutoDev — Build error parsing, file validation, constants, error memory, and tool declarations.
 * Extraído de autodev-service.ts para reducir su tamaño.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SchemaType, FunctionDeclaration } from '@google/generative-ai';

const requireModule = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

// ─── Build error parsing ────────────────────────────────────────────

export interface ParsedBuildError {
  file: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
}

export function parseBuildErrors(buildOutput: string): ParsedBuildError[] {
  const errors: ParsedBuildError[] = [];
  const seen = new Set<string>();

  const patterns = [
    /([^\s(]+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/g,
    /([^\s(]+\.tsx?)[:.](\d+)[:.](\d+)\s*[-–]\s*error\s+(TS\d+):\s*(.+)/g,
    /ERROR.*?([^\s]+\.tsx?):(\d+):(\d+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(buildOutput)) !== null) {
      const key = `${match[1]}:${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({
        file: match[1].replace(/\\/g, '/'),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10) || undefined,
        code: match[4] || undefined,
        message: match[5]?.trim() || 'Unknown error',
      });
    }
  }

  // Vite/Rollup/esbuild error parsing
  if (errors.length === 0) {
    const vitePatterns = [
      /(?:Rollup|vite).*?failed to resolve import\s+"([^"]+)"\s+in\s+"([^"]+)"/gi,
      /Could not resolve\s+"([^"]+)"\s+(?:from|in)\s+"([^"]+)"/gi,
      /(?:RollupError|Error):\s*(.+?)\s+in\s+([^\s]+\.tsx?)/gi,
      /\[vite\].*?(?:error|Error)\s+(.+?)(?:\s+at\s+([^\s]+\.tsx?))?/gi,
      /✘\s*\[ERROR\]\s*(.+)/gi,
    ];

    for (const pattern of vitePatterns) {
      let match;
      while ((match = pattern.exec(buildOutput)) !== null) {
        const file = (match[2] || 'unknown').replace(/\\/g, '/');
        const message = match[1]?.trim() || match[0]?.trim() || 'Vite/Rollup error';
        const key = `vite:${file}:${message.slice(0, 50)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        errors.push({ file, message: `[Vite/Rollup] ${message}`, code: 'VITE_ERR' });
      }
    }

    if (errors.length === 0 && /build failed|error during build|rollup.*error/i.test(buildOutput)) {
      errors.push({
        file: 'unknown',
        message: `Build failed with unparsed error. Raw output: ${buildOutput.slice(0, 2000)}`,
        code: 'BUILD_FAIL',
      });
    }
  }

  return errors;
}

// ─── Safety: Validate file before writing ───────────────────────────

export function findPhantomImports(code: string, filePath: string, _repoPath: string): string[] {
  const phantoms: string[] = [];
  const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importPath = match[1];
    const dir = path.dirname(filePath);
    const resolved = path.resolve(dir, importPath);
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json'];
    const exists = extensions.some(ext => fs.existsSync(resolved + ext)) ||
                   fs.existsSync(path.join(resolved, 'index.ts')) ||
                   fs.existsSync(path.join(resolved, 'index.tsx')) ||
                   fs.existsSync(path.join(resolved, 'index.js'));
    if (!exists) {
      phantoms.push(importPath);
    }
  }
  return phantoms;
}

export function isCodeComplete(code: string): boolean {
  if (code.endsWith('// ...') || code.endsWith('...') || code.endsWith('// TODO')) return false;

  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inComment) {
      if (ch === '*' && next === '/') { inComment = false; i++; }
      continue;
    }
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }

    if (ch === '{') braceCount++;
    if (ch === '}') braceCount--;
  }

  if (braceCount > 2) return false;
  return true;
}

// ─── Constants ─────────────────────────────────────────────────────

const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;
let userDataPath = '';
if (isElectron) {
  try {
    const electron = requireModule('electron');
    userDataPath = path.join(electron.app.getPath('userData'), '.autodev-data');
  } catch {
    userDataPath = path.join(process.cwd(), '.autodev-data');
  }
} else {
  const appData = process.platform === 'win32'
    ? process.env.APPDATA
    : process.env.HOME + (process.platform === 'darwin' ? '/Library/Application Support' : '/.config');
  userDataPath = path.join(appData || '', 'soflia-hub-desktop', '.autodev-data');
}

if (!fs.existsSync(userDataPath)) {
  try { fs.mkdirSync(userDataPath, { recursive: true }); } catch {}
}

export const CONFIG_PATH = path.join(userDataPath, 'autodev-config.json');
export const HISTORY_PATH = path.join(userDataPath, 'autodev-history.json');
export const ERROR_MEMORY_PATH = path.join(userDataPath, 'autodev-error-memory.json');
export const MAX_HISTORY_RUNS = 50;
export const IGNORE_DIRS = ['node_modules', 'dist', 'dist-electron', '.git', 'build', 'coverage', 'SofLIA - Extension'];
export const ISSUES_FILENAME = 'AUTODEV_ISSUES.md';
export { userDataPath };

// ─── Error Memory (learns from past build failures) ─────────────────

export interface ErrorMemoryEntry {
  pattern: string;
  file: string;
  fix: string;
  occurrences: number;
  lastSeen: string;
}

export function loadErrorMemory(): ErrorMemoryEntry[] {
  try {
    if (fs.existsSync(ERROR_MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(ERROR_MEMORY_PATH, 'utf-8'));
    }
  } catch { /* empty */ }
  return [];
}

export function saveErrorMemory(entries: ErrorMemoryEntry[]): void {
  try {
    if (!fs.existsSync(userDataPath)) { fs.mkdirSync(userDataPath, { recursive: true }); }
    const trimmed = entries.sort((a, b) => b.occurrences - a.occurrences).slice(0, 200);
    fs.writeFileSync(ERROR_MEMORY_PATH, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[AutoDev ErrorMemory] Save failed:', err.message);
  }
}

// ─── Tool declarations for function calling agents ─────────────────

export const RESEARCH_TOOLS: FunctionDeclaration[] = [
  {
    name: 'web_search',
    description: 'Search the web for information about packages, vulnerabilities, best practices, documentation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { query: { type: SchemaType.STRING, description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'read_webpage',
    description: 'Read and extract text content from a URL (documentation, changelogs, advisories).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { url: { type: SchemaType.STRING, description: 'URL to read' } },
      required: ['url'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project for additional context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { path: { type: SchemaType.STRING, description: 'Relative path to the file' } },
      required: ['path'],
    },
  },
];
