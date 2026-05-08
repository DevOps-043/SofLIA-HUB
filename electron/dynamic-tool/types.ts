export type GeminiSchemaNode = Record<string, any>;

export interface ToolFileTemplate {
  fileName: string;
  content: string;
}

export interface ToolsetManifest {
  id: string;
  name: string;
  description: string;
  version: number;
  installedAt: string;
  source: 'builtin';
  envRequired: string[];
  toolNames: string[];
  promptHints: string[];
}

export interface InstallableToolsetDefinition {
  id: string;
  name: string;
  description: string;
  envRequired: string[];
  toolNames: string[];
  promptHints: string[];
  buildFiles: () => ToolFileTemplate[];
}
