import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler?: (args: any) => Promise<any> | any;
}

export interface ToolSourceInfo {
  filePath: string;
  filename: string;
  rootPath: string;
}

function normalizeDirectories(directories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const directory of directories) {
    const trimmed = directory?.trim();
    if (!trimmed) {
      continue;
    }

    const resolved = path.resolve(trimmed);
    const key = resolved.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(resolved);
  }

  return result;
}

export class MCPManager extends EventEmitter {
  private readonly defaultToolDirectories: string[];
  private toolDirectories: string[];
  private tools: Map<string, ToolSchema>;
  private toolSources: Map<string, ToolSourceInfo>;
  private watchers: fs.FSWatcher[];
  private initialized = false;

  constructor(toolsDirs?: string[] | string) {
    super();

    const initialDirectories = Array.isArray(toolsDirs)
      ? toolsDirs
      : toolsDirs
      ? [toolsDirs]
      : [path.join(process.cwd(), 'tools', 'dynamic')];

    this.defaultToolDirectories = normalizeDirectories(initialDirectories);
    this.toolDirectories = [...this.defaultToolDirectories];
    this.tools = new Map();
    this.toolSources = new Map();
    this.watchers = [];
  }

  public configureDirectories(toolDirs: string[]): void {
    const nextDirectories = normalizeDirectories(
      toolDirs.length > 0 ? toolDirs : this.defaultToolDirectories,
    );

    const current = this.toolDirectories.join('|').toLowerCase();
    const next = nextDirectories.join('|').toLowerCase();
    if (current === next) {
      return;
    }

    this.toolDirectories = nextDirectories;
  }

  public getDirectories(): string[] {
    return [...this.toolDirectories];
  }

  public async initialize(): Promise<void> {
    await this.ensureDirectories();
    await this.scanTools();
    this.watchTools();
    this.initialized = true;
  }

  private async ensureDirectories(): Promise<void> {
    for (const directory of this.toolDirectories) {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
    }
  }

  private async scanTools(): Promise<void> {
    this.tools.clear();
    this.toolSources.clear();

    try {
      for (const directory of this.toolDirectories) {
        if (!fs.existsSync(directory)) {
          continue;
        }

        const files = fs.readdirSync(directory).sort((a, b) => a.localeCompare(b));
        for (const file of files) {
          const filePath = path.join(directory, file);
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) {
            continue;
          }
          await this.loadToolFromPath(filePath, directory);
        }
      }
    } catch (error) {
      console.error('[MCP] Error scanning dynamic tools:', error);
    }
  }

  private watchTools(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    for (const directory of this.toolDirectories) {
      try {
        const watcher = fs.watch(directory, async () => {
          try {
            await this.scanTools();
          } catch (error) {
            console.error(`[MCP] Error refreshing tools for ${directory}:`, error);
          }
        });
        this.watchers.push(watcher);
        console.log(`[MCP] Watching dynamic tools in: ${directory}`);
      } catch (error) {
        console.error(`[MCP] Error watching dynamic tools directory ${directory}:`, error);
      }
    }
  }

  private async loadToolFromPath(filePath: string, rootPath: string): Promise<void> {
    const filename = path.basename(filePath);
    const ext = path.extname(filename);

    if (!['.json', '.js', '.ts'].includes(ext)) {
      return;
    }

    try {
      let toolData: any = null;

      if (ext === '.json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        toolData = JSON.parse(content);
      } else {
        const fileUrl = pathToFileURL(filePath).href;
        const moduleUrl = `${fileUrl}?t=${Date.now()}`;
        const module = await import(moduleUrl);
        toolData = module.default || module.tool || module;
      }

      if (!this.isValidToolSchema(toolData)) {
        console.warn(`[MCP] Invalid tool schema in file: ${filePath}`);
        return;
      }

      const existingSource = this.toolSources.get(toolData.name);
      if (existingSource) {
        console.log(
          `[MCP] Tool "${toolData.name}" from ${filePath} ignored because it is already provided by ${existingSource.filePath}`,
        );
        return;
      }

      this.tools.set(toolData.name, toolData);
      this.toolSources.set(toolData.name, {
        filePath,
        filename,
        rootPath,
      });

      this.emit('tool-registered', toolData);
      console.log(`[MCP] Registered dynamic tool: ${toolData.name} (${filePath})`);
    } catch (error) {
      console.error(`[MCP] Error loading tool from ${filePath}:`, error);
    }
  }

  private isValidToolSchema(data: any): data is ToolSchema {
    return (
      data &&
      typeof data.name === 'string' &&
      typeof data.description === 'string' &&
      data.inputSchema &&
      typeof data.inputSchema === 'object' &&
      data.inputSchema.type === 'object' &&
      typeof data.inputSchema.properties === 'object'
    );
  }

  public getTools(): ToolSchema[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): ToolSchema | undefined {
    return this.tools.get(name);
  }

  public getToolSource(name: string): ToolSourceInfo | undefined {
    return this.toolSources.get(name);
  }

  public async refreshTools(): Promise<void> {
    await this.ensureDirectories();
    await this.scanTools();
    if (this.initialized) {
      this.watchTools();
    }
  }

  public async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    if (typeof tool.handler === 'function') {
      return await tool.handler(args);
    }

    throw new Error(`Tool ${name} has no executable handler. It might be a declarative tool.`);
  }

  public destroy(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.removeAllListeners();
  }
}

export const mcpManager = new MCPManager();
