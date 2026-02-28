import { clipboard } from 'electron';
import { EventEmitter } from 'events';

export interface ClipboardItem {
  text: string;
  timestamp: Date;
}

export class ClipboardManager extends EventEmitter {
  private history: ClipboardItem[] = [];
  private maxItems: number;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(maxItems = 10) {
    super();
    this.maxItems = maxItems;
  }

  public init(): void {
    try {
      const currentText = clipboard.readText();
      if (currentText && currentText.trim() !== '') {
        this.history.push({
          text: currentText,
          timestamp: new Date()
        });
      }
    } catch (err) {
      console.error('[ClipboardManager] Init error:', err);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.intervalId = setInterval(() => {
      try {
        const currentText = clipboard.readText();
        if (!currentText || currentText.trim() === '') return;

        const lastItem = this.history.length > 0 ? this.history[0] : null;
        
        if (!lastItem || lastItem.text !== currentText) {
          const newItem = {
            text: currentText,
            timestamp: new Date()
          };
          
          this.history.unshift(newItem);
          
          if (this.history.length > this.maxItems) {
            this.history.pop();
          }
          
          this.emit('clipboard-changed', newItem);
        }
      } catch (error) {
        console.error('[ClipboardManager] Interval error:', error);
      }
    }, 2000);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
  }

  public getClipboardHistory(): ClipboardItem[] {
    return [...this.history];
  }

  public writeToClipboard(text: string): void {
    if (!text) return;
    
    try {
      clipboard.writeText(text);
      const newItem = {
        text,
        timestamp: new Date()
      };
      
      const lastItem = this.history.length > 0 ? this.history[0] : null;
      if (!lastItem || lastItem.text !== text) {
        this.history.unshift(newItem);
        if (this.history.length > this.maxItems) {
          this.history.pop();
        }
        this.emit('clipboard-changed', newItem);
      }
    } catch (error) {
      console.error('[ClipboardManager] Write error:', error);
      throw error;
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      itemCount: this.history.length,
      maxItems: this.maxItems
    };
  }

  public getConfig() {
    return {
      maxItems: this.maxItems,
      intervalMs: 2000
    };
  }
}

// Exportamos un singleton
export const clipboardManager = new ClipboardManager();

// Declaración de herramienta para WhatsApp Agent
export const remote_clipboard_tool = {
  name: 'remote_clipboard_tool',
  description: 'Gestor de portapapeles remoto. Permite leer el historial reciente (últimos 10 textos copiados en la PC) o escribir texto en el portapapeles de la PC. Modos: "read" o "write".',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      action: { type: 'STRING' as const, description: 'Acción a realizar: "read" para obtener el historial, "write" para copiar texto al portapapeles de la PC.' },
      text: { type: 'STRING' as const, description: 'Texto a copiar. Requerido solo si la acción es "write".' },
    },
    required: ['action'],
  },
};

// Handler para la herramienta de WhatsApp
export async function handleRemoteClipboardTool(args: Record<string, any>) {
  try {
    const { action, text } = args;
    
    if (action === 'read') {
      const history = clipboardManager.getClipboardHistory();
      if (history.length === 0) {
        return { success: true, message: 'El portapapeles de la PC está vacío.' };
      }
      return { 
        success: true, 
        history: history.map(item => ({
          text: item.text.length > 500 ? item.text.substring(0, 500) + '...' : item.text,
          time: item.timestamp.toLocaleString('es-MX')
        }))
      };
    } else if (action === 'write') {
      if (!text) {
        return { success: false, error: 'Debes proveer el texto a copiar.' };
      }
      clipboardManager.writeToClipboard(text);
      return { success: true, message: 'Texto copiado al portapapeles de la PC exitosamente.' };
    } else {
      return { success: false, error: 'Acción no válida. Usa "read" o "write".' };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar la herramienta del portapapeles.' };
  }
}
