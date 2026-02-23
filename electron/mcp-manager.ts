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

export class MCPManager extends EventEmitter {
  private dynamicToolsPath: string;
  private tools: Map<string, ToolSchema>;
  private watcher: fs.FSWatcher | null = null;
  private fileToToolMap: Map<string, string>;

  constructor(toolsDir?: string) {
    super();
    // Path relativo a la raíz del proyecto para el contexto de AutoDev
    this.dynamicToolsPath = toolsDir || path.join(process.cwd(), 'tools', 'dynamic');
    this.tools = new Map();
    this.fileToToolMap = new Map();
  }

  public async initialize(): Promise<void> {
    if (!fs.existsSync(this.dynamicToolsPath)) {
      fs.mkdirSync(this.dynamicToolsPath, { recursive: true });
    }

    await this.scanTools();
    this.watchTools();
  }

  private async scanTools(): Promise<void> {
    try {
      const files = fs.readdirSync(this.dynamicToolsPath);
      for (const file of files) {
        await this.loadTool(file);
      }
    } catch (error) {
      console.error('[MCP] Error scanning dynamic tools:', error);
    }
  }

  private watchTools(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    try {
      // Usar fs.watch sobre la carpeta para detectar cambios, adiciones o eliminaciones
      this.watcher = fs.watch(this.dynamicToolsPath, async (_eventType, filename) => {
        if (!filename) return;
        
        const filePath = path.join(this.dynamicToolsPath, filename);
        
        try {
          if (fs.existsSync(filePath)) {
            console.log(`[MCP] Tool file changed/added: ${filename}`);
            await this.loadTool(filename);
          } else {
            console.log(`[MCP] Tool file removed: ${filename}`);
            this.removeToolByFilename(filename);
          }
        } catch (error) {
          console.error(`[MCP] Error handling change for ${filename}:`, error);
        }
      });
      console.log(`[MCP] Watching for dynamic tools in: ${this.dynamicToolsPath}`);
    } catch (error) {
      console.error('[MCP] Error watching dynamic tools directory:', error);
    }
  }

  private async loadTool(filename: string): Promise<void> {
    const filePath = path.join(this.dynamicToolsPath, filename);
    const ext = path.extname(filename);
    
    // Ignorar archivos que no sean json, js o ts
    if (!['.json', '.js', '.ts'].includes(ext)) {
      return;
    }

    try {
      let toolData: any = null;

      if (ext === '.json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        toolData = JSON.parse(content);
      } else if (ext === '.ts' || ext === '.js') {
        // En Node.js/Vite, las importaciones dinámicas se cachean.
        // Para evitarlo, usamos un query param temporal (cache-busting).
        const fileUrl = pathToFileURL(filePath).href;
        const moduleUrl = `${fileUrl}?t=${Date.now()}`;
        
        const module = await import(moduleUrl);
        // Soporta la exportación por default, con nombre "tool", o directamente el objeto módulo
        toolData = module.default || module.tool || module;
      }

      if (this.isValidToolSchema(toolData)) {
        // Si ya existía una herramienta mapeada a este archivo, la desregistramos si cambió el nombre
        if (this.fileToToolMap.has(filename) && this.fileToToolMap.get(filename) !== toolData.name) {
          this.removeToolByFilename(filename);
        }

        this.tools.set(toolData.name, toolData);
        this.fileToToolMap.set(filename, toolData.name);
        
        this.emit('tool-registered', toolData);
        console.log(`[MCP] Successfully registered dynamic tool: ${toolData.name}`);
      } else {
        console.warn(`[MCP] Invalid tool schema in file: ${filename}`);
      }
    } catch (error) {
      console.error(`[MCP] Error loading tool from ${filename}:`, error);
    }
  }

  private removeToolByFilename(filename: string): void {
    const toolName = this.fileToToolMap.get(filename);
    if (toolName) {
      this.tools.delete(toolName);
      this.fileToToolMap.delete(filename);
      this.emit('tool-unregistered', toolName);
      console.log(`[MCP] Unregistered dynamic tool: ${toolName}`);
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
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.removeAllListeners();
  }
}

// Exportamos una instancia compartida (singleton) de MCPManager
export const mcpManager = new MCPManager();
