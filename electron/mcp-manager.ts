import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';
import type { FSWatcher } from 'fs';

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
  private watcher: FSWatcher | null = null;
  private fileToToolMap: Map<string, string[]>;

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
    
    // Log nativo confirmando la cantidad de herramientas dinámicas cargadas exitosamente
    console.log(`[MCP] Inicialización completa. Se cargaron exitosamente ${this.tools.size} herramientas dinámicas desde ${this.dynamicToolsPath}`);
    
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
        // Soporta la exportación por default, con nombre "tool", "tools", o directamente el objeto módulo
        toolData = module.default || module.tools || module.tool || module;
      }

      // Si ya existían herramientas mapeadas a este archivo, las desregistramos para actualizar
      this.removeToolByFilename(filename);
      
      const loadedToolNames: string[] = [];

      // Soporte para exportar un array de herramientas desde un solo archivo
      const toolsToRegister = Array.isArray(toolData) ? toolData : [toolData];

      for (const tool of toolsToRegister) {
        if (this.isValidToolSchema(tool)) {
          this.tools.set(tool.name, tool as ToolSchema);
          loadedToolNames.push(tool.name);
          
          this.emit('tool-registered', tool);
          console.log(`[MCP] Successfully registered dynamic tool: ${tool.name}`);
        } else {
          // Buscamos si el objeto exportado tiene valores que son tools (ej. export const tool1 = {...})
          if (typeof tool === 'object' && tool !== null) {
            for (const key of Object.keys(tool)) {
              const innerTool = tool[key];
              if (this.isValidToolSchema(innerTool)) {
                this.tools.set(innerTool.name, innerTool as ToolSchema);
                loadedToolNames.push(innerTool.name);
                this.emit('tool-registered', innerTool);
                console.log(`[MCP] Successfully registered dynamic tool: ${innerTool.name} from export '${key}'`);
              }
            }
          } else {
            console.warn(`[MCP] Invalid tool schema in file or object: ${filename}`);
          }
        }
      }

      // Guardamos la referencia de cuáles herramientas vinieron de este archivo
      if (loadedToolNames.length > 0) {
        this.fileToToolMap.set(filename, loadedToolNames);
      } else {
        console.warn(`[MCP] No valid tools found in file: ${filename}`);
      }

    } catch (error) {
      console.error(`[MCP] Error loading tool from ${filename}:`, error);
    }
  }

  private removeToolByFilename(filename: string): void {
    const toolNames = this.fileToToolMap.get(filename);
    if (toolNames && toolNames.length > 0) {
      for (const toolName of toolNames) {
        this.tools.delete(toolName);
        this.emit('tool-unregistered', toolName);
        console.log(`[MCP] Unregistered dynamic tool: ${toolName}`);
      }
      this.fileToToolMap.delete(filename);
    }
  }

  // Se utiliza `any` para evitar conflictos con z.ZodSchema estricto en la inferencia y prevenir TS2345
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
