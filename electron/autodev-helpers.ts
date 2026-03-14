/**
 * AutoDev helper functions — pure utilities extracted from AutoDevService.
 * These have no class dependencies and can be used standalone.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AutoDevImprovement, AutoDevRun } from './autodev-types';
import { IGNORE_DIRS, userDataPath, loadErrorMemory } from './autodev-validation';

// ─── File reading ─────────────────────────────────────────────

const MAX_TOTAL_CHARS = 300_000;
const MAX_FILE_CHARS = 25_000;

export function readProjectFiles(repoPath: string): Array<{ path: string; content: string }> {
  const allFiles: Array<{ path: string; size: number; priority: number }> = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.some(d => relPath.startsWith(d) || entry.name === d)) walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > 500_000) continue;
        const normalizedPath = relPath.replace(/\\/g, '/');
        const priority = normalizedPath.startsWith('electron/') ? 0
          : normalizedPath.startsWith('src/') ? 1 : 2;
        allFiles.push({ path: normalizedPath, size: stat.size, priority });
      } catch { /* skip */ }
    }
  };
  walk(repoPath);

  allFiles.sort((a, b) => a.priority - b.priority || a.size - b.size);

  const files: Array<{ path: string; content: string }> = [];
  let totalChars = 0;

  for (const f of allFiles) {
    if (totalChars >= MAX_TOTAL_CHARS) break;
    try {
      const fullPath = path.join(repoPath, f.path);
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.length > MAX_FILE_CHARS) {
        content = content.slice(0, MAX_FILE_CHARS) + '\n// ... [truncated by AutoDev — file too large]';
      }
      const remaining = MAX_TOTAL_CHARS - totalChars;
      if (content.length > remaining) {
        content = content.slice(0, remaining) + '\n// ... [truncated by AutoDev — budget limit]';
      }
      files.push({ path: f.path, content });
      totalChars += content.length;
    } catch { /* skip */ }
  }

  console.log(`[AutoDev] readProjectFiles: ${files.length}/${allFiles.length} files, ${Math.round(totalChars / 1000)}K chars (budget: ${MAX_TOTAL_CHARS / 1000}K)`);
  return files;
}

export function getDependenciesList(repoPath: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8'));
    return Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
      .map(([n, v]) => `${n}@${v}`).join('\n');
  } catch { return 'Could not read package.json'; }
}

// ─── Improvement filtering ────────────────────────────────────

export function getRealImprovements(improvements: AutoDevImprovement[]): AutoDevImprovement[] {
  return improvements.filter(i => i.applied && !(i as any).wasDeleted);
}

// ─── Commit/PR message generation ─────────────────────────────

export function generateCommitMessage(improvements: AutoDevImprovement[]): string {
  const applied = getRealImprovements(improvements);
  const deleted = improvements.filter(i => (i as any).wasDeleted);
  const cats = [...new Set(applied.map(i => i.category))];
  const lines = [
    `Automated improvements: ${cats.join(', ')}`,
    '', ...applied.map(i => `- [${i.category}] ${i.file}: ${i.description}`),
  ];
  if (deleted.length > 0) {
    lines.push('', '## Archivos eliminados (no contados como mejoras):');
    lines.push(...deleted.map(i => `- ${i.file}: ${i.description}`));
  }
  lines.push('', `Files: ${[...new Set(applied.map(i => i.file))].length} | Sources: ${[...new Set(applied.flatMap(i => i.researchSources))].slice(0, 5).join(', ')}`);
  return lines.join('\n');
}

export function generatePRTitle(improvements: AutoDevImprovement[]): string {
  const applied = getRealImprovements(improvements);
  const cats = [...new Set(applied.map(i => i.category))];
  return `${cats.join(', ')}: ${applied.length} automated improvements`;
}

export function generatePRBody(run: AutoDevRun): string {
  const applied = getRealImprovements(run.improvements);
  const deleted = run.improvements.filter(i => (i as any).wasDeleted);
  const findings = run.researchFindings.filter(f => f.actionable);
  const lines = [
    '## Summary',
    `AutoDev multi-agent run — ${run.agentTasks.length} agents deployed, ${applied.length} improvements applied.`,
    '',
    '## Agents Used',
    ...run.agentTasks.map(t => `- **${t.description}** (${t.model}) — ${t.status}`),
    '',
    '## Improvements',
    ...applied.map(i => `- **[${i.category}]** \`${i.file}\`: ${i.description}\n  Sources: ${i.researchSources.map(s => `[link](${s})`).join(', ') || 'N/A'}`),
  ];
  if (deleted.length > 0) {
    lines.push('', '## Archivos eliminados (trabajo fallido — no contados como mejoras)');
    lines.push(...deleted.map(i => `- \`${i.file}\`: ${i.description}`));
  }
  lines.push(
    '',
    '## Research Conducted',
    ...findings.slice(0, 10).map(f => `- **[${f.category}]** ${f.findings}\n  Sources: ${f.sources.map(s => `[link](${s})`).join(', ')}`),
    '', '---', '🤖 Generated by AutoDev multi-agent system (SofLIA-HUB)',
  );
  return lines.join('\n');
}

// ─── Version safety ───────────────────────────────────────────

const PROTECTED_PACKAGES = [
  'react', 'react-dom', 'vite', 'electron', 'typescript',
  '@electron/rebuild', '@electron-toolkit/preload', '@electron-toolkit/utils',
  'electron-builder', 'electron-vite',
];

export function hasMajorVersionBump(oldContent: string, newContent: string): boolean {
  try {
    const oldPkg = JSON.parse(oldContent);
    const newPkg = JSON.parse(newContent);

    for (const section of ['dependencies', 'devDependencies'] as const) {
      const oldDeps = oldPkg[section] || {};
      const newDeps = newPkg[section] || {};
      for (const pkg of Object.keys(newDeps)) {
        if (!oldDeps[pkg]) continue;
        const oldMajor = (oldDeps[pkg] as string).replace(/[\^~>=<\s]/g, '').split('.')[0];
        const newMajor = (newDeps[pkg] as string).replace(/[\^~>=<\s]/g, '').split('.')[0];
        if (oldMajor !== newMajor) {
          console.warn(`[AutoDev SafetyGuard] Major bump detected: ${pkg} ${oldDeps[pkg]} → ${newDeps[pkg]} (major: ${oldMajor} → ${newMajor})`);
          if (PROTECTED_PACKAGES.includes(pkg) || parseInt(newMajor) > parseInt(oldMajor)) {
            return true;
          }
        }
      }
    }
  } catch {
    console.warn('[AutoDev SafetyGuard] Could not parse package.json for version comparison — blocking write');
    return true;
  }
  return false;
}

// ─── JSON parsing ─────────────────────────────────────────────

export function parseJSON(text: string): any {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* fall through */ } }
  try { return JSON.parse(text); } catch { return null; }
}

// ─── Error memory context ─────────────────────────────────────

export function getErrorMemoryContext(): string {
  const errorMemory = loadErrorMemory();
  if (!errorMemory.length) return 'No hay errores registrados de runs anteriores.';
  const top = errorMemory.slice(0, 15);
  return top.map(m => `- [${m.pattern}] en ${m.file}: ${m.fix} (ocurrencias: ${m.occurrences}, último: ${m.lastSeen})`).join('\n');
}

export function getRunHistorySummary(history: AutoDevRun[]): string {
  if (!history.length) return 'No hay historial de runs anteriores.';
  const recent = history.slice(-5);
  return recent.map(r => {
    const applied = r.improvements.filter(i => i.applied).length;
    return `- Run ${r.id} (${r.startedAt.slice(0, 10)}): ${r.status} — ${applied} mejoras aplicadas${r.error ? ` — Error: ${r.error.slice(0, 100)}` : ''}`;
  }).join('\n');
}

// ─── WhatsApp queue ───────────────────────────────────────────

export function queueWhatsApp(phone: string, message: string): void {
  try {
    if (!fs.existsSync(userDataPath)) { fs.mkdirSync(userDataPath, { recursive: true }); }
    const qPath = path.join(userDataPath, 'whatsapp-queue.json');
    let queue: Array<{ phone: string; message: string }> = [];
    if (fs.existsSync(qPath)) {
      queue = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    }
    queue.push({ phone, message });
    fs.writeFileSync(qPath, JSON.stringify(queue), 'utf8');
  } catch (err: unknown) {
    console.error('[AutoDev] WhatsApp queue error:', err instanceof Error ? err.message : err);
  }
}

// ─── Token routing ────────────────────────────────────────────

export async function getOptimalModel(
  genAI: { getGenerativeModel: (config: { model: string }) => { countTokens: (text: string) => Promise<{ totalTokens: number }> } },
  intendedModel: string,
  promptText: string,
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: intendedModel });
    const { totalTokens } = await model.countTokens(promptText);

    if (totalTokens > 200000) {
      console.log(`\n[AutoDev Tokenizer] ⚠️ Prompt masivo detectado: ${totalTokens} tokens.`);
      console.log(`[AutoDev Tokenizer] 📉 Cambiando modelo '${intendedModel}' -> 'gemini-3-flash-preview' por límite de tarifa (200k) y economía.`);
      return 'gemini-3-flash-preview';
    }
    return intendedModel;
  } catch {
    const estimatedTokens = Math.ceil(promptText.length / 4);
    if (estimatedTokens > 200000) {
      console.log(`\n[AutoDev Tokenizer] ⚠️ Prompt masivo detectado por heurística: ~${estimatedTokens} tokens.`);
      console.log(`[AutoDev Tokenizer] 📉 Cambiando modelo '${intendedModel}' -> 'gemini-3-flash-preview' preventivamente.`);
      return 'gemini-3-flash-preview';
    }
    return intendedModel;
  }
}
