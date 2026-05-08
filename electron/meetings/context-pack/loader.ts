import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { parseMeetingTypeRegistry, parseThreshold } from './parser';
import type { ContextPackFileMap, LoadedContextPackFiles, MeetingContextPack } from './types';

const PACK_DIR = 'Context Pack';

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export class MeetingContextPackLoader {
  private cache: Promise<MeetingContextPack> | null = null;

  load(): Promise<MeetingContextPack> {
    if (!this.cache) this.cache = this.loadInternal();
    return this.cache;
  }

  private async loadInternal(): Promise<MeetingContextPack> {
    const rootDir = await this.resolveRootDir();
    const files = await this.readFiles(rootDir);
    let outputSchema: Record<string, unknown> = {};
    try {
      outputSchema = JSON.parse(files.outputSchemaRaw) as Record<string, unknown>;
    } catch {
      console.warn('[MeetingContextPack] output_schema.json invalido, usando schema vacio');
    }

    return {
      ...files,
      outputSchema,
      meetingTypes: parseMeetingTypeRegistry(files.meetingTypeRegistryRaw),
      fallbackThreshold: parseThreshold(files.extractionRulesRaw, /confidence\s*<\s*(0\.\d+)/i, 0.6),
      reducedAggressivenessUpper: parseThreshold(files.extractionRulesRaw, /entre\s*0\.\d+\s*y\s*(0\.\d+)/i, 0.75),
    };
  }

  private async resolveRootDir(): Promise<string> {
    const candidates = new Set<string>();
    if (process.env.APP_ROOT) candidates.add(process.env.APP_ROOT);
    try {
      const appPath = app.getAppPath();
      candidates.add(appPath);
      candidates.add(path.resolve(appPath, '..'));
    } catch {
      // process.cwd remains as fallback
    }
    candidates.add(process.cwd());

    for (const candidate of candidates) {
      const hasRootAgents = await pathExists(path.join(candidate, 'AGENTS.md'));
      const hasPromptMaster = await pathExists(path.join(candidate, PACK_DIR, 'prompt_master.md'));
      if (hasRootAgents && hasPromptMaster) return candidate;
    }
    return Array.from(candidates)[0] || process.cwd();
  }

  private async readFiles(rootDir: string): Promise<LoadedContextPackFiles> {
    const fileMap: Record<keyof ContextPackFileMap, string> = {
      rootAgents: 'AGENTS.md',
      packAgents: path.join(PACK_DIR, 'AGENTS.md'),
      meetingTypeRegistryRaw: path.join(PACK_DIR, 'meeting_type_registry.yaml'),
      extractionRulesRaw: path.join(PACK_DIR, 'extraction_rules.yaml'),
      outputSchemaRaw: path.join(PACK_DIR, 'output_schema.json'),
      promptMaster: path.join(PACK_DIR, 'prompt_master.md'),
      sourceTraceability: path.join(PACK_DIR, 'source_traceability.md'),
      implementationNotes: path.join(PACK_DIR, 'implementation_notes.md'),
      rootReadme: 'README.md',
      packReadme: path.join(PACK_DIR, 'README.md'),
      manifest: path.join(PACK_DIR, 'manifest.txt'),
    };
    const requiredKeys: Array<keyof ContextPackFileMap> = [
      'rootAgents', 'packAgents', 'meetingTypeRegistryRaw', 'extractionRulesRaw', 'outputSchemaRaw', 'promptMaster',
    ];
    const values = {} as ContextPackFileMap;
    const missingFiles: string[] = [];

    for (const [key, relativePath] of Object.entries(fileMap) as Array<[keyof ContextPackFileMap, string]>) {
      try {
        values[key] = await fs.readFile(path.join(rootDir, relativePath), 'utf8');
      } catch {
        if (requiredKeys.includes(key)) throw new Error(`No pude cargar el archivo obligatorio del context pack: ${relativePath}`);
        missingFiles.push(relativePath);
      }
    }
    return { ...values, missingFiles };
  }
}
