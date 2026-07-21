import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { parseMeetingTypeRegistry, parseThreshold } from './parser';
import type { ContextPackFileMap, LoadedContextPackFiles, MeetingContextPack } from './types';

const DEVELOPMENT_PACK_PATH = path.join('resources', 'context-packs', 'meetings', 'v1');
const PACKAGED_PACK_PATH = path.join('context-packs', 'meetings', 'v1');

type ContextPackLocation = {
  rootDir: string;
  packDir: string;
};

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
    const location = await this.resolveLocation();
    const files = await this.readFiles(location);
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

  private async resolveLocation(): Promise<ContextPackLocation> {
    const candidates: ContextPackLocation[] = [];
    const developmentRoots = new Set<string>();
    if (process.env.APP_ROOT) developmentRoots.add(process.env.APP_ROOT);

    let appRoot = process.cwd();
    try {
      const appPath = app.getAppPath();
      appRoot = appPath;
      developmentRoots.add(appPath);
      developmentRoots.add(path.resolve(appPath, '..'));
    } catch {
      // process.cwd remains as fallback
    }
    developmentRoots.add(process.cwd());

    if (process.resourcesPath) {
      candidates.push({
        rootDir: appRoot,
        packDir: path.join(process.resourcesPath, PACKAGED_PACK_PATH),
      });
    }

    for (const rootDir of developmentRoots) {
      candidates.push({
        rootDir,
        packDir: path.join(rootDir, DEVELOPMENT_PACK_PATH),
      });
    }

    for (const candidate of candidates) {
      const hasPromptMaster = await pathExists(path.join(candidate.packDir, 'prompt_master.md'));
      if (hasPromptMaster) return candidate;
    }

    throw new Error(
      `No pude localizar el context pack de reuniones. Rutas revisadas: ${candidates
        .map(candidate => candidate.packDir)
        .join(', ')}`,
    );
  }

  private async readFiles(location: ContextPackLocation): Promise<LoadedContextPackFiles> {
    const fileMap: Record<keyof ContextPackFileMap, string> = {
      rootAgents: path.join(location.rootDir, 'AGENTS.md'),
      packAgents: path.join(location.packDir, 'AGENTS.md'),
      meetingTypeRegistryRaw: path.join(location.packDir, 'meeting_type_registry.yaml'),
      extractionRulesRaw: path.join(location.packDir, 'extraction_rules.yaml'),
      outputSchemaRaw: path.join(location.packDir, 'output_schema.json'),
      promptMaster: path.join(location.packDir, 'prompt_master.md'),
      sourceTraceability: path.join(location.packDir, 'source_traceability.md'),
      implementationNotes: path.join(location.packDir, 'implementation_notes.md'),
      rootReadme: path.join(location.rootDir, 'README.md'),
      packReadme: path.join(location.packDir, 'README.md'),
      manifest: path.join(location.packDir, 'manifest.txt'),
    };
    const requiredKeys: Array<keyof ContextPackFileMap> = [
      'packAgents', 'meetingTypeRegistryRaw', 'extractionRulesRaw', 'outputSchemaRaw', 'promptMaster',
    ];
    const values = {} as ContextPackFileMap;
    const missingFiles: string[] = [];

    for (const [key, filePath] of Object.entries(fileMap) as Array<[keyof ContextPackFileMap, string]>) {
      try {
        values[key] = await fs.readFile(filePath, 'utf8');
      } catch {
        if (requiredKeys.includes(key)) throw new Error(`No pude cargar el archivo obligatorio del context pack: ${filePath}`);
        values[key] = '';
        missingFiles.push(filePath);
      }
    }
    return { ...values, missingFiles };
  }
}
