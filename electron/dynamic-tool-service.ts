import { mcpManager, type RuntimeToolExecutionContext } from './mcp-manager';
import { buildBuiltinToolsetCatalog } from './dynamic-tool/home-assistant';
import { createDynamicToolPaths } from './dynamic-tool/paths';
import { getGeminiFunctionDeclarations, listDynamicTools } from './dynamic-tool/runtime';
import { doctorToolsets } from './dynamic-tool/toolset-doctor';
import { installToolset, uninstallToolset } from './dynamic-tool/toolset-installer';
import { listInstallableToolsets, listInstalledToolsets } from './dynamic-tool/toolset-listing';

export class DynamicToolService {
  private initialized = false;
  private readonly builtinToolsets = buildBuiltinToolsetCatalog();
  private readonly paths = createDynamicToolPaths();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    mcpManager.configureDirectories(this.paths.getConfiguredToolDirectories());
    await mcpManager.initialize();
    await this.paths.ensureMetadataRoot();
    this.initialized = true;
  }

  async listTools() {
    await this.initialize();
    return listDynamicTools(this.paths);
  }

  async hasTool(name: string): Promise<boolean> {
    await this.initialize();
    return Boolean(mcpManager.getTool(name));
  }

  async getRuntimeDescriptor(name: string) {
    await this.initialize();
    return mcpManager.getRuntimeDescriptor(name);
  }

  async executeTool(name: string, args: unknown, context: RuntimeToolExecutionContext): Promise<unknown> {
    await this.initialize();
    return mcpManager.executeTool(name, args, context);
  }

  async getGeminiFunctionDeclarations(): Promise<Array<Record<string, unknown>>> {
    await this.initialize();
    return getGeminiFunctionDeclarations();
  }

  async listInstallableToolsets() {
    await this.initialize();
    return listInstallableToolsets(this.builtinToolsets, await this.listInstalledToolsets());
  }

  async listInstalledToolsets() {
    await this.initialize();
    return listInstalledToolsets(this.paths);
  }

  async doctorToolsets() {
    await this.initialize();
    return doctorToolsets(this.paths, await this.listInstalledToolsets(), await this.listTools());
  }

  async installToolset(toolsetId: string) {
    await this.initialize();
    return installToolset(this.paths, this.builtinToolsets, toolsetId);
  }

  async uninstallToolset(toolsetId: string) {
    await this.initialize();
    return uninstallToolset(this.paths, toolsetId);
  }

  async installHomeAssistantToolset() {
    return this.installToolset('home-assistant');
  }
}

export const dynamicToolService = new DynamicToolService();
