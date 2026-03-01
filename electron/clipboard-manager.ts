import { clipboard } from 'electron';
import { EventEmitter } from 'events';
import { z } from 'zod';

export interface ClipboardConfig {
  maxHistorySize?: number;
  pollingIntervalMs?: number;
}

// 6. Esquema Zod para la herramienta de IA sin errores TS2558 en genéricos
export const ClipboardToolSchema = z.object({
  action: z.enum(['read', 'write', 'history']),
  content: z.string().optional()
});

export type ClipboardToolInput = z.infer<typeof ClipboardToolSchema>;

// Definición de la herramienta para ser consumida por el agente de IA
export const clipboardManagerTool = {
  name: 'clipboard_manager',
  description: 'Permite leer, escribir y ver el historial del portapapeles de la PC. Útil para compartir texto, enlaces o comandos rápidamente entre la IA/WhatsApp y la PC local del usuario.',
  parameters: ClipboardToolSchema
};

/**
 * Servicio para gestionar el portapapeles del sistema.
 * Soporta sincronización bidireccional, lectura, escritura y un historial de copias.
 */
export class ClipboardManager extends EventEmitter {
  private history: string[] = [];
  private maxHistorySize: number;
  private pollingIntervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private lastReadText: string = '';

  constructor(config: ClipboardConfig = {}) {
    super();
    this.maxHistorySize = config.maxHistorySize || 20;
    this.pollingIntervalMs = config.pollingIntervalMs || 1000;
  }

  public init(): void {
    try {
      this.lastReadText = clipboard.readText() || '';
      if (this.lastReadText) {
        this.addToHistory(this.lastReadText);
      }
      console.log('[ClipboardManager] Inicializado correctamente.');
    } catch (error) {
      console.error('[ClipboardManager] Error al inicializar:', error);
    }
  }

  public start(): void {
    if (this.intervalId) return;
    
    // Iniciar polling para monitorear copias del usuario fuera de SofLIA
    this.intervalId = setInterval(() => {
      this.checkClipboard();
    }, this.pollingIntervalMs);
    
    console.log('[ClipboardManager] Servicio de monitoreo iniciado.');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[ClipboardManager] Servicio de monitoreo detenido.');
  }

  public getStatus() {
    return {
      active: !!this.intervalId,
      historyCount: this.history.length,
      maxHistory: this.maxHistorySize
    };
  }

  public getConfig(): ClipboardConfig {
    return {
      maxHistorySize: this.maxHistorySize,
      pollingIntervalMs: this.pollingIntervalMs
    };
  }

  private checkClipboard(): void {
    try {
      const currentText = clipboard.readText();
      if (currentText && currentText !== this.lastReadText) {
        this.lastReadText = currentText;
        this.addToHistory(currentText);
        this.emit('changed', currentText);
      }
    } catch (error) {
      // Los errores de lectura se ignoran silenciosamente para no inundar la consola en cada tick
    }
  }

  private addToHistory(text: string): void {
    if (!text || !text.trim()) return;
    
    // Evitar duplicados consecutivos en el historial
    if (this.history.length > 0 && this.history[0] === text) return;
    
    this.history.unshift(text);
    
    // Mantener el tamaño máximo del historial
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }
  }

  public writeText(text: string): void {
    try {
      clipboard.writeText(text);
      this.lastReadText = text;
      this.addToHistory(text);
      this.emit('changed', text);
    } catch (error) {
      console.error('[ClipboardManager] Error al escribir en portapapeles:', error);
      throw new Error(`No se pudo escribir en el portapapeles: ${(error as Error).message}`);
    }
  }

  public readText(): string {
    try {
      return clipboard.readText() || '';
    } catch (error) {
      console.error('[ClipboardManager] Error al leer portapapeles:', error);
      throw new Error(`No se pudo leer el portapapeles: ${(error as Error).message}`);
    }
  }

  public getHistory(): string[] {
    return [...this.history];
  }
  
  /**
   * Método principal para que la IA interactúe con el portapapeles.
   * Delega a los submétodos según la acción solicitada.
   */
  public async executeTool(args: ClipboardToolInput): Promise<any> {
    try {
      switch (args.action) {
        case 'read': {
          const text = this.readText();
          return { 
            success: true, 
            data: { text: text || '(Portapapeles vacío)' } 
          };
        }
        case 'write': {
          if (!args.content) {
            return { success: false, error: 'Se requiere el campo "content" para la acción "write".' };
          }
          this.writeText(args.content);
          return { 
            success: true, 
            message: 'Texto copiado exitosamente al portapapeles del sistema.' 
          };
        }
        case 'history': {
          const hist = this.getHistory();
          return { 
            success: true, 
            data: { 
              total: hist.length, 
              items: hist.length > 0 ? hist : ['(Historial vacío)'] 
            } 
          };
        }
        default:
          return { success: false, error: `Acción no soportada: ${args.action}` };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

// Exportar una instancia singleton del servicio para toda la aplicación
export const clipboardManagerService = new ClipboardManager();
