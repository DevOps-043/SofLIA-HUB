import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export interface MeetingTypeDefinition {
  id: string;
  displayName: string;
  purpose: string;
  bestFor: string[];
  cadence: string;
  durationExpected: string;
  titleKeywords: string[];
  languagePatterns: string[];
  structuralSignals: string[];
  negativeSignals: string[];
  expectedStructure: string[];
  extractionFocus: string[];
  highValueOutputs: string[];
  defaultDestination: 'IRIS' | 'Project Hub' | 'Team' | 'Project' | 'None';
  routingNotes: string;
  commonConfusions: string[];
  confidenceHints: string[];
}

export interface MeetingContextPack {
  rootAgents: string;
  packAgents: string;
  meetingTypeRegistryRaw: string;
  extractionRulesRaw: string;
  outputSchema: Record<string, unknown>;
  outputSchemaRaw: string;
  promptMaster: string;
  sourceTraceability?: string;
  implementationNotes?: string;
  rootReadme?: string;
  packReadme?: string;
  manifest?: string;
  meetingTypes: MeetingTypeDefinition[];
  fallbackThreshold: number;
  reducedAggressivenessUpper: number;
  missingFiles: string[];
}

interface ContextPackFileMap {
  rootAgents: string;
  packAgents: string;
  meetingTypeRegistryRaw: string;
  extractionRulesRaw: string;
  outputSchemaRaw: string;
  promptMaster: string;
  sourceTraceability?: string;
  implementationNotes?: string;
  rootReadme?: string;
  packReadme?: string;
  manifest?: string;
}

interface LoadedContextPackFiles extends ContextPackFileMap {
  missingFiles: string[];
}

const PACK_DIR = 'Context Pack';

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]/, '').replace(/['"]$/, '').trim();
}

function parsePurposeValue(lines: string[], index: number, initialValue: string): { value: string; nextIndex: number } {
  const baseIndent = lines[index].match(/^\s*/)?.[0].length ?? 0;
  const chunks = [stripQuotes(initialValue)];
  let cursor = index + 1;
  while (cursor < lines.length) {
    const line = lines[cursor];
    const trimmed = line.trim();
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (!trimmed) {
      cursor += 1;
      continue;
    }
    if (indent <= baseIndent || trimmed.startsWith('- ') || trimmed.includes(':')) {
      break;
    }
    chunks.push(stripQuotes(trimmed));
    cursor += 1;
  }
  return {
    value: chunks.filter(Boolean).join(' ').trim(),
    nextIndex: cursor - 1,
  };
}

function parseMeetingTypeRegistry(raw: string): MeetingTypeDefinition[] {
  const lines = raw.split(/\r?\n/);
  const meetingTypes: MeetingTypeDefinition[] = [];
  let current: MeetingTypeDefinition | null = null;
  let activeList:
    | 'titleKeywords'
    | 'languagePatterns'
    | 'structuralSignals'
    | 'negativeSignals'
    | 'expectedStructure'
    | 'extractionFocus'
    | 'highValueOutputs'
    | 'bestFor'
    | 'commonConfusions'
    | 'confidenceHints'
    | 'secondaryDestinations'
    | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'meeting_types:') {
      continue;
    }

    if (trimmed.startsWith('- id:')) {
      if (current) {
        meetingTypes.push(current);
      }
      current = {
        id: stripQuotes(trimmed.slice('- id:'.length)),
        displayName: '',
        purpose: '',
        bestFor: [],
        cadence: 'unknown',
        durationExpected: 'unknown',
        titleKeywords: [],
        languagePatterns: [],
        structuralSignals: [],
        negativeSignals: [],
        expectedStructure: [],
        extractionFocus: [],
        highValueOutputs: [],
        defaultDestination: 'None',
        routingNotes: '',
        commonConfusions: [],
        confidenceHints: [],
      };
      activeList = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (trimmed.startsWith('display_name:')) {
      current.displayName = stripQuotes(trimmed.slice('display_name:'.length));
      activeList = null;
      continue;
    }

    if (trimmed.startsWith('purpose:')) {
      const parsed = parsePurposeValue(lines, index, trimmed.slice('purpose:'.length));
      current.purpose = parsed.value;
      index = parsed.nextIndex;
      activeList = null;
      continue;
    }

    if (trimmed.startsWith('cadence:')) {
      current.cadence = stripQuotes(trimmed.slice('cadence:'.length));
      activeList = null;
      continue;
    }

    if (trimmed.startsWith('duration_expected:')) {
      current.durationExpected = stripQuotes(trimmed.slice('duration_expected:'.length));
      activeList = null;
      continue;
    }

    if (trimmed.startsWith('notes:')) {
      const parsed = parsePurposeValue(lines, index, trimmed.slice('notes:'.length));
      current.routingNotes = parsed.value;
      index = parsed.nextIndex;
      activeList = null;
      continue;
    }

    if (trimmed === 'title_keywords:') {
      activeList = 'titleKeywords';
      continue;
    }
    if (trimmed === 'language_patterns:') {
      activeList = 'languagePatterns';
      continue;
    }
    if (trimmed === 'structural_signals:') {
      activeList = 'structuralSignals';
      continue;
    }
    if (trimmed === 'negative_signals:') {
      activeList = 'negativeSignals';
      continue;
    }
    if (trimmed === 'expected_structure:') {
      activeList = 'expectedStructure';
      continue;
    }
    if (trimmed === 'extraction_focus:') {
      activeList = 'extractionFocus';
      continue;
    }
    if (trimmed === 'high_value_outputs:') {
      activeList = 'highValueOutputs';
      continue;
    }
    if (trimmed === 'best_for:') {
      activeList = 'bestFor';
      continue;
    }
    if (trimmed === 'common_confusions:') {
      activeList = 'commonConfusions';
      continue;
    }
    if (trimmed === 'confidence_hints:') {
      activeList = 'confidenceHints';
      continue;
    }
    if (trimmed === 'secondary_destinations:') {
      activeList = 'secondaryDestinations';
      continue;
    }

    if (trimmed.startsWith('default_destination:')) {
      const destination = stripQuotes(trimmed.slice('default_destination:'.length));
      current.defaultDestination = ['IRIS', 'Project Hub', 'Team', 'Project', 'None'].includes(destination)
        ? destination as MeetingTypeDefinition['defaultDestination']
        : 'None';
      activeList = null;
      continue;
    }

    if (trimmed.startsWith('- ') && activeList) {
      if (activeList === 'secondaryDestinations') {
        // secondary_destinations parsed but not stored separately — already in routingNotes
      } else {
        current[activeList].push(stripQuotes(trimmed.slice(2)));
      }
      continue;
    }

    if (!trimmed.endsWith(':')) {
      activeList = null;
    }
  }

  if (current) {
    meetingTypes.push(current);
  }

  return meetingTypes;
}

function parseThreshold(raw: string, expression: RegExp, fallback: number): number {
  const match = raw.match(expression);
  if (!match?.[1]) {
    return fallback;
  }
  const nextValue = Number.parseFloat(match[1]);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

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
    if (!this.cache) {
      this.cache = this.loadInternal();
    }
    return this.cache;
  }

  private async loadInternal(): Promise<MeetingContextPack> {
    const rootDir = await this.resolveRootDir();
    const files = await this.readFiles(rootDir);
    let outputSchema: Record<string, unknown> = {};
    try {
      outputSchema = JSON.parse(files.outputSchemaRaw) as Record<string, unknown>;
    } catch {
      console.warn('[MeetingContextPack] output_schema.json inválido, usando schema vacío');
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

    if (process.env.APP_ROOT) {
      candidates.add(process.env.APP_ROOT);
    }

    try {
      const appPath = app.getAppPath();
      candidates.add(appPath);
      candidates.add(path.resolve(appPath, '..'));
    } catch {
      // Ignore; process.cwd() remains as a fallback.
    }

    candidates.add(process.cwd());

    for (const candidate of candidates) {
      const hasRootAgents = await pathExists(path.join(candidate, 'AGENTS.md'));
      const hasPromptMaster = await pathExists(path.join(candidate, PACK_DIR, 'prompt_master.md'));
      if (hasRootAgents && hasPromptMaster) {
        return candidate;
      }
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
      'rootAgents',
      'packAgents',
      'meetingTypeRegistryRaw',
      'extractionRulesRaw',
      'outputSchemaRaw',
      'promptMaster',
    ];

    const values = {} as ContextPackFileMap;
    const missingFiles: string[] = [];

    for (const [key, relativePath] of Object.entries(fileMap) as Array<[keyof ContextPackFileMap, string]>) {
      const absolutePath = path.join(rootDir, relativePath);
      try {
        values[key] = await fs.readFile(absolutePath, 'utf8');
      } catch {
        if (requiredKeys.includes(key)) {
          throw new Error(`No pude cargar el archivo obligatorio del context pack: ${relativePath}`);
        }
        missingFiles.push(relativePath);
      }
    }

    return {
      ...values,
      missingFiles,
    };
  }
}
