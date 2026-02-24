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

  constructor(toolsDir?: string) {
    super();
    // Path relativo a la raíz del proyecto para el contexto de AutoDev
    this.dynamicToolsPath = toolsDir || path.join(process.cwd(), 'tools', 'dynamic');
    this.tools = new Map();
  }

  public async initialize(): Promise<void> {
    if (!fs.existsSync(this.dynamicToolsPath)) {
      fs.mkdirSync(this.dynamicToolsPath, { recursive: true });
    }

    this.registerMetaTools();
  }

  private registerMetaTools(): void {
    // Meta-tool 1: discover_tools
    this.tools.set('discover_tools', {
      name: 'discover_tools',
      description: 'Lee el directorio de herramientas dinámicas (.ts, .js, .json) y devuelve los esquemas disponibles para su uso.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return await this.discoverDynamicTools();
      }
    });

    // Meta-tool 2: execute_dynamic_tool
    this.tools.set('execute_dynamic_tool', {
      name: 'execute_dynamic_tool',
      description: 'Carga y ejecuta dinámicamente una herramienta por su nombre de archivo (ej. "my_tool.ts"), previniendo desbordes de tokens.',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'El nombre del archivo de la herramienta a ejecutar (ej. "calculator.ts")'
          },
          args: {
            type: 'object',
            description: 'Los argumentos requeridos por la herramienta'
          }
        },
        required: ['filename', 'args']
      },
      handler: async (args: { filename: string; args: any }) => {
        return await this.executeDynamicModule(args.filename, args.args);
      }
    });
  }

  private async discoverDynamicTools(): Promise<any[]> {
    const schemas: any[] = [];
    try {
      const files = fs.readdirSync(this.dynamicToolsPath);
      for (const file of files) {
        const ext = path.extname(file);
        if (!['.json', '.js', '.ts'].includes(ext)) {
          continue;
        }

        const toolData = await this.loadDynamicTool(file);
        if (toolData) {
          schemas.push({
            filename: file,
            name: toolData.name,
            description: toolData.description,
            inputSchema: toolData.inputSchema
          });
        }
      }
    } catch (error) {
      console.error('[MCP] Error discovering dynamic tools:', error);
    }
    return schemas;
  }

  private async loadDynamicTool(filename: string): Promise<ToolSchema | null> {
    const filePath = path.join(this.dynamicToolsPath, filename);
    const ext = path.extname(filename);
    
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

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
        return toolData;
      } else {
        console.warn(`[MCP] Invalid tool schema in file: ${filename}`);
      }
    } catch (error) {
      console.error(`[MCP] Error loading dynamic tool from ${filename}:`, error);
    }
    return null;
  }

  public async executeDynamicModule(filename: string, args: any): Promise<any> {
    const tool = await this.loadDynamicTool(filename);
    if (!tool) {
      throw new Error(`Dynamic tool not found or invalid: ${filename}`);
    }
    
    if (typeof tool.handler === 'function') {
      return await tool.handler(args);
    }
    
    throw new Error(`Dynamic tool in ${filename} has no executable handler.`);
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
      throw new Error(`Tool not found: ${name}. Use discover_tools to find dynamic tools and execute_dynamic_tool to run them.`);
    }
    
    if (typeof tool.handler === 'function') {
      return await tool.handler(args);
    }
    
    throw new Error(`Tool ${name} has no executable handler. It might be a declarative tool.`);
  }

  public destroy(): void {
    this.removeAllListeners();
  }
}

// Exportamos una instancia compartida (singleton) de MCPManager
export const mcpManager = new MCPManager();
