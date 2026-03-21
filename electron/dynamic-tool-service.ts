import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mcpManager, type ToolSchema, type ToolSourceInfo } from './mcp-manager';

type GeminiSchemaNode = Record<string, any>;

interface ToolFileTemplate {
  fileName: string;
  content: string;
}

interface ToolsetManifest {
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

interface InstallableToolsetDefinition {
  id: string;
  name: string;
  description: string;
  envRequired: string[];
  toolNames: string[];
  promptHints: string[];
  buildFiles: () => ToolFileTemplate[];
}

function normalizeGeminiSchemaNode(node: any): GeminiSchemaNode {
  if (!node || typeof node !== 'object') {
    return { type: 'STRING' };
  }

  const normalized: Record<string, any> = { ...node };
  if (typeof normalized.type === 'string') {
    normalized.type = normalized.type.toUpperCase();
  }

  if (normalized.properties && typeof normalized.properties === 'object') {
    const nextProps: Record<string, any> = {};
    for (const [key, value] of Object.entries(normalized.properties)) {
      nextProps[key] = normalizeGeminiSchemaNode(value);
    }
    normalized.properties = nextProps;
  }

  if (normalized.items) {
    normalized.items = normalizeGeminiSchemaNode(normalized.items);
  }

  return normalized;
}

function buildHomeAssistantListStatesTool(): string {
  return `function getConfig() {
  const baseUrl = process.env.SOFLIA_HOME_ASSISTANT_URL?.trim();
  const token = process.env.SOFLIA_HOME_ASSISTANT_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new Error('Faltan SOFLIA_HOME_ASSISTANT_URL y/o SOFLIA_HOME_ASSISTANT_TOKEN en el entorno.');
  }
  return { baseUrl: baseUrl.replace(/\\/+$/, ''), token };
}

async function callApi(endpoint, init = {}) {
  const { baseUrl, token } = getConfig();
  const response = await fetch(baseUrl + endpoint, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Home Assistant devolvio ' + response.status + ': ' + text);
  }
  return response.json();
}

export default {
  name: 'home_assistant_list_states',
  description: 'Lista estados y entidades de Home Assistant. Util cuando SofLIA necesita descubrir entity_id antes de controlar luces, enchufes o sensores.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Filtro opcional por dominio, por ejemplo light, switch, climate o sensor.' },
      entity_id: { type: 'string', description: 'Filtro opcional por entity_id exacto.' },
    },
  },
  async handler(args = {}) {
    const allStates = await callApi('/api/states');
    let filtered = Array.isArray(allStates) ? allStates : [];
    if (args.domain) {
      filtered = filtered.filter((item) => String(item.entity_id || '').startsWith(String(args.domain) + '.'));
    }
    if (args.entity_id) {
      filtered = filtered.filter((item) => item.entity_id === args.entity_id);
    }
    return {
      success: true,
      count: filtered.length,
      states: filtered.slice(0, 100),
    };
  },
};
`;
}

function buildHomeAssistantGetStateTool(): string {
  return `function getConfig() {
  const baseUrl = process.env.SOFLIA_HOME_ASSISTANT_URL?.trim();
  const token = process.env.SOFLIA_HOME_ASSISTANT_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new Error('Faltan SOFLIA_HOME_ASSISTANT_URL y/o SOFLIA_HOME_ASSISTANT_TOKEN en el entorno.');
  }
  return { baseUrl: baseUrl.replace(/\\/+$/, ''), token };
}

async function callApi(endpoint, init = {}) {
  const { baseUrl, token } = getConfig();
  const response = await fetch(baseUrl + endpoint, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Home Assistant devolvio ' + response.status + ': ' + text);
  }
  return response.json();
}

export default {
  name: 'home_assistant_get_state',
  description: 'Obtiene el estado actual de una entidad especifica de Home Assistant.',
  inputSchema: {
    type: 'object',
    properties: {
      entity_id: { type: 'string', description: 'Entity ID completo, por ejemplo light.sala o switch.cafetera.' },
    },
    required: ['entity_id'],
  },
  async handler(args = {}) {
    if (!args.entity_id) {
      throw new Error('entity_id es obligatorio.');
    }
    const state = await callApi('/api/states/' + encodeURIComponent(String(args.entity_id)));
    return {
      success: true,
      state,
    };
  },
};
`;
}

function buildHomeAssistantCallServiceTool(): string {
  return `function getConfig() {
  const baseUrl = process.env.SOFLIA_HOME_ASSISTANT_URL?.trim();
  const token = process.env.SOFLIA_HOME_ASSISTANT_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new Error('Faltan SOFLIA_HOME_ASSISTANT_URL y/o SOFLIA_HOME_ASSISTANT_TOKEN en el entorno.');
  }
  return { baseUrl: baseUrl.replace(/\\/+$/, ''), token };
}

async function callApi(endpoint, init = {}) {
  const { baseUrl, token } = getConfig();
  const response = await fetch(baseUrl + endpoint, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Home Assistant devolvio ' + response.status + ': ' + text);
  }
  if (response.status === 204) {
    return [];
  }
  const rawText = await response.text();
  return rawText ? JSON.parse(rawText) : [];
}

export default {
  name: 'home_assistant_call_service',
  description: 'Ejecuta un servicio de Home Assistant. Sirve para controlar luces, enchufes, escenas y cualquier dominio soportado.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: 'Dominio del servicio, por ejemplo light, switch, climate, scene o script.' },
      service: { type: 'string', description: 'Servicio a ejecutar, por ejemplo turn_on, turn_off, toggle, set_temperature o activate.' },
      entity_id: { type: 'string', description: 'Entity ID opcional para la accion.' },
      data_json: { type: 'string', description: 'JSON opcional adicional para el cuerpo del servicio. Ejemplo: {"brightness_pct":50}.' },
    },
    required: ['domain', 'service'],
  },
  async handler(args = {}) {
    if (!args.domain || !args.service) {
      throw new Error('domain y service son obligatorios.');
    }

    let body = {};
    if (args.data_json) {
      body = JSON.parse(String(args.data_json));
    }
    if (args.entity_id) {
      body.entity_id = args.entity_id;
    }

    const result = await callApi(
      '/api/services/' + encodeURIComponent(String(args.domain)) + '/' + encodeURIComponent(String(args.service)),
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    return {
      success: true,
      result,
    };
  },
};
`;
}

function buildBuiltinToolsetCatalog(): Record<string, InstallableToolsetDefinition> {
  return {
    'home-assistant': {
      id: 'home-assistant',
      name: 'Home Assistant',
      description: 'Controla luces, switches, escenas, sensores y cualquier entidad expuesta por Home Assistant mediante su API REST.',
      envRequired: ['SOFLIA_HOME_ASSISTANT_URL', 'SOFLIA_HOME_ASSISTANT_TOKEN'],
      toolNames: [
        'home_assistant_list_states',
        'home_assistant_get_state',
        'home_assistant_call_service',
      ],
      promptHints: [
        'Usa este toolset cuando el usuario pida prender o apagar luces, escenas, sensores o automatizaciones de Home Assistant.',
        'Si las herramientas ya estan instaladas pero faltan variables de entorno, informa exactamente cuales faltan.',
      ],
      buildFiles: () => [
        {
          fileName: 'home-assistant.home_assistant_list_states.js',
          content: buildHomeAssistantListStatesTool(),
        },
        {
          fileName: 'home-assistant.home_assistant_get_state.js',
          content: buildHomeAssistantGetStateTool(),
        },
        {
          fileName: 'home-assistant.home_assistant_call_service.js',
          content: buildHomeAssistantCallServiceTool(),
        },
      ],
    },
  };
}

export class DynamicToolService {
  private initialized = false;
  private readonly builtinToolsets = buildBuiltinToolsetCatalog();

  private getWorkspaceDynamicToolsPath(): string {
    return path.join(process.cwd(), 'tools', 'dynamic');
  }

  private getManagedDynamicToolsPath(): string {
    return path.join(app.getPath('userData'), 'dynamic-tools');
  }

  private getToolsetMetadataRootPath(): string {
    return path.join(this.getManagedDynamicToolsPath(), '_toolsets');
  }

  private getToolsetManifestPath(toolsetId: string): string {
    return path.join(this.getToolsetMetadataRootPath(), toolsetId, 'manifest.json');
  }

  private getConfiguredToolDirectories(): string[] {
    return [
      this.getWorkspaceDynamicToolsPath(),
      this.getManagedDynamicToolsPath(),
    ];
  }

  private async getManagedToolsetFiles(toolsetId: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.getManagedDynamicToolsPath(), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(`${toolsetId}.`))
        .map((entry) => path.join(this.getManagedDynamicToolsPath(), entry.name));
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    mcpManager.configureDirectories(this.getConfiguredToolDirectories());
    await mcpManager.initialize();
    await fs.mkdir(this.getToolsetMetadataRootPath(), { recursive: true });
    this.initialized = true;
  }

  private getToolSourceScope(source?: ToolSourceInfo): 'workspace' | 'managed' | 'unknown' {
    if (!source) {
      return 'unknown';
    }

    const rootPath = source.rootPath.toLowerCase();
    if (rootPath === this.getWorkspaceDynamicToolsPath().toLowerCase()) {
      return 'workspace';
    }
    if (rootPath === this.getManagedDynamicToolsPath().toLowerCase()) {
      return 'managed';
    }
    return 'unknown';
  }

  async listTools(): Promise<Array<{
    name: string;
    description: string;
    inputSchema: ToolSchema['inputSchema'];
    executable: boolean;
    sourceScope: 'workspace' | 'managed' | 'unknown';
    sourcePath?: string;
  }>> {
    await this.initialize();
    return mcpManager.getTools().map((tool) => {
      const source = mcpManager.getToolSource(tool.name);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        executable: typeof tool.handler === 'function',
        sourceScope: this.getToolSourceScope(source),
        sourcePath: source?.filePath,
      };
    });
  }

  async hasTool(name: string): Promise<boolean> {
    await this.initialize();
    return Boolean(mcpManager.getTool(name));
  }

  async executeTool(name: string, args: any): Promise<any> {
    await this.initialize();
    return mcpManager.executeTool(name, args);
  }

  async getGeminiFunctionDeclarations(): Promise<any[]> {
    await this.initialize();
    return mcpManager.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: normalizeGeminiSchemaNode(tool.inputSchema),
    }));
  }

  async listInstallableToolsets(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    envRequired: string[];
    toolNames: string[];
    promptHints: string[];
    installed: boolean;
  }>> {
    await this.initialize();
    const installed = await this.listInstalledToolsets();
    const installedIds = new Set(installed.map((item) => item.id));

    return Object.values(this.builtinToolsets).map((toolset) => ({
      id: toolset.id,
      name: toolset.name,
      description: toolset.description,
      envRequired: [...toolset.envRequired],
      toolNames: [...toolset.toolNames],
      promptHints: [...toolset.promptHints],
      installed: installedIds.has(toolset.id),
    }));
  }

  async listInstalledToolsets(): Promise<ToolsetManifest[]> {
    await this.initialize();

    const metadataRoot = this.getToolsetMetadataRootPath();
    const manifests: ToolsetManifest[] = [];

    try {
      const entries = await fs.readdir(metadataRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const manifestPath = this.getToolsetManifestPath(entry.name);
        try {
          const raw = await fs.readFile(manifestPath, 'utf8');
          manifests.push(JSON.parse(raw) as ToolsetManifest);
        } catch (error) {
          console.warn(`[DynamicToolService] No se pudo leer el manifiesto del toolset ${entry.name}:`, error);
        }
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('[DynamicToolService] Error listando toolsets instalados:', error);
      }
    }

    manifests.sort((a, b) => a.name.localeCompare(b.name));
    return manifests;
  }

  async doctorToolsets(): Promise<Array<{
    id: string;
    name: string;
    status: 'ok' | 'degraded' | 'missing';
    issues: string[];
    env: Array<{ name: string; present: boolean }>;
    installedTools: string[];
    loadedTools: string[];
    manifestPath: string;
    files: string[];
  }>> {
    await this.initialize();

    const installed = await this.listInstalledToolsets();
    const loadedTools = await this.listTools();
    const loadedByToolName = new Map(loadedTools.map((tool) => [tool.name, tool]));

    const diagnostics = await Promise.all(installed.map(async (toolset) => {
      const issues: string[] = [];
      const files = await this.getManagedToolsetFiles(toolset.id);
      const env = toolset.envRequired.map((name) => ({
        name,
        present: Boolean(process.env[name]?.trim()),
      }));
      const loadedForToolset = toolset.toolNames.filter((name) => {
        const tool = loadedByToolName.get(name);
        return tool?.sourceScope === 'managed';
      });

      if (files.length === 0) {
        issues.push('No se encontraron archivos del toolset en dynamic-tools.');
      }
      if (loadedForToolset.length !== toolset.toolNames.length) {
        const missingTools = toolset.toolNames.filter((name) => !loadedForToolset.includes(name));
        issues.push(`Faltan tools cargadas: ${missingTools.join(', ')}`);
      }
      const missingEnv = env.filter((item) => !item.present).map((item) => item.name);
      if (missingEnv.length > 0) {
        issues.push(`Faltan variables de entorno: ${missingEnv.join(', ')}`);
      }

      return {
        id: toolset.id,
        name: toolset.name,
        status: issues.length === 0 ? 'ok' as const : files.length === 0 ? 'missing' as const : 'degraded' as const,
        issues,
        env,
        installedTools: [...toolset.toolNames],
        loadedTools: loadedForToolset,
        manifestPath: this.getToolsetManifestPath(toolset.id),
        files,
      };
    }));

    diagnostics.sort((a, b) => a.name.localeCompare(b.name));
    return diagnostics;
  }

  async installToolset(toolsetId: string): Promise<{
    success: boolean;
    toolset_id: string;
    name: string;
    installedTools: string[];
    files: string[];
    managedToolsPath: string;
    manifestPath: string;
    envRequired: string[];
    alreadyInstalled: boolean;
    message: string;
  }> {
    await this.initialize();

    const toolset = this.builtinToolsets[toolsetId];
    if (!toolset) {
      throw new Error(`No existe un toolset instalable con id "${toolsetId}".`);
    }

    const managedToolsPath = this.getManagedDynamicToolsPath();
    const manifestPath = this.getToolsetManifestPath(toolsetId);
    const alreadyInstalled = await fs
      .access(manifestPath)
      .then(() => true)
      .catch(() => false);

    await fs.mkdir(managedToolsPath, { recursive: true });
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });

    const files = toolset.buildFiles();
    const writtenFiles: string[] = [];

    for (const file of files) {
      const absolutePath = path.join(managedToolsPath, file.fileName);
      await fs.writeFile(absolutePath, file.content, 'utf8');
      writtenFiles.push(absolutePath);
    }

    const manifest: ToolsetManifest = {
      id: toolset.id,
      name: toolset.name,
      description: toolset.description,
      version: 1,
      installedAt: new Date().toISOString(),
      source: 'builtin',
      envRequired: [...toolset.envRequired],
      toolNames: [...toolset.toolNames],
      promptHints: [...toolset.promptHints],
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    await mcpManager.refreshTools();

    return {
      success: true,
      toolset_id: toolset.id,
      name: toolset.name,
      installedTools: [...toolset.toolNames],
      files: writtenFiles,
      managedToolsPath,
      manifestPath,
      envRequired: [...toolset.envRequired],
      alreadyInstalled,
      message: alreadyInstalled
        ? `Toolset ${toolset.name} actualizado en ${managedToolsPath}. Verifica las variables ${toolset.envRequired.join(', ')} para usarlo.`
        : `Toolset ${toolset.name} instalado en ${managedToolsPath}. Configura ${toolset.envRequired.join(', ')} para usarlo.`,
    };
  }

  async uninstallToolset(toolsetId: string): Promise<{
    success: boolean;
    toolset_id: string;
    removedFiles: string[];
    removedManifest: boolean;
    message: string;
  }> {
    await this.initialize();

    const manifestPath = this.getToolsetManifestPath(toolsetId);
    const files = await this.getManagedToolsetFiles(toolsetId);
    let removedManifest = false;

    for (const file of files) {
      await fs.rm(file, { force: true });
    }

    try {
      await fs.rm(path.dirname(manifestPath), { recursive: true, force: true });
      removedManifest = true;
    } catch {
      removedManifest = false;
    }

    await mcpManager.refreshTools();

    return {
      success: true,
      toolset_id: toolsetId,
      removedFiles: files,
      removedManifest,
      message: files.length > 0 || removedManifest
        ? `Toolset ${toolsetId} desinstalado del directorio dinámico administrado.`
        : `No encontré archivos administrados para el toolset ${toolsetId}, pero se refrescó el catálogo.`,
    };
  }

  async installHomeAssistantToolset() {
    return this.installToolset('home-assistant');
  }
}

export const dynamicToolService = new DynamicToolService();
