import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { normalizeDirectories } from './mcp-manager/directories';
import type { ToolSchema, ToolSourceInfo } from './mcp-manager/types';
import { ensureToolDirectories } from './mcp-manager/ensure-directories';
import { executeRegisteredTool } from './mcp-manager/execution';
import { registerToolFromPath } from './mcp-manager/registry';
import { scanToolDirectories } from './mcp-manager/scan';
import { closeToolWatchers, resetToolWatchers } from './mcp-manager/watchers';
export type { ToolSchema, ToolSourceInfo } from './mcp-manager/types';
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
    if (this.toolDirectories.join('|').toLowerCase() === nextDirectories.join('|').toLowerCase()) return;
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
    if (this.initialized) this.watchTools();
  }
  public async executeTool(name: string, args: any): Promise<any> {
    return executeRegisteredTool(this.tools, name, args);
  }
  public destroy(): void {
    this.watchers = closeToolWatchers(this.watchers);
    this.removeAllListeners();
  }
  private async ensureDirectories(): Promise<void> {
    ensureToolDirectories(this.toolDirectories);
  }
  private async scanTools(): Promise<void> {
    this.tools.clear();
    this.toolSources.clear();
    await scanToolDirectories(this.toolDirectories, (filePath, rootPath) =>
      registerToolFromPath(filePath, rootPath, this.tools, this.toolSources, (tool) => {
        this.emit('tool-registered', tool);
      }),
    );
  }
  private watchTools(): void {
    this.watchers = resetToolWatchers(this.watchers, this.toolDirectories, async () => {
      await this.scanTools();
    });
  }
}
export const mcpManager = new MCPManager();
