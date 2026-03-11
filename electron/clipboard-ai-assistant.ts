import { EventEmitter } from 'node:events';
import { clipboard } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ClipboardConfig {
  maxHistorySize?: number;
  pollingIntervalMs?: number;
  apiKey?: string;
}

export interface ClipboardStatus {
  isRunning: boolean;
  historyCount: number;
}

export interface ClipboardItem {
  id: string;
  timestamp: number;
  text: string;
}

export class ClipboardAIAssistant extends EventEmitter {
  private config: ClipboardConfig;
  private intervalId?: NodeJS.Timeout;
  private history: ClipboardItem[] = [];
  private lastCopiedText: string = '';
  private genAI: GoogleGenerativeAI | null = null;
  private isRunning: boolean = false;

  constructor(config: ClipboardConfig) {
    super();
    this.config = {
      maxHistorySize: 100,
      pollingIntervalMs: 5000,
      ...config
    };
    if (this.config.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    }
  }

  async init(): Promise<void> {
    this.history = [];
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    try {
      this.lastCopiedText = clipboard.readText();
    } catch {
      this.lastCopiedText = '';
    }

    this.intervalId = setInterval(() => {
      this.pollClipboard();
    }, this.config.pollingIntervalMs || 5000);
    
    console.log('[ClipboardAIAssistant] Servicio de portapapeles iniciado silenciosamente.');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('[ClipboardAIAssistant] Servicio de portapapeles detenido.');
  }

  getStatus(): ClipboardStatus {
    return {
      isRunning: this.isRunning,
      historyCount: this.history.length
    };
  }

  getConfig(): ClipboardConfig {
    return this.config;
  }
  
  updateApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private pollClipboard() {
    try {
      const currentText = clipboard.readText();
      
      if (currentText && currentText.trim() !== '' && currentText !== this.lastCopiedText) {
        this.lastCopiedText = currentText;
        
        const existingIndex = this.history.findIndex(item => item.text === currentText);
        if (existingIndex !== -1) {
          this.history.splice(existingIndex, 1);
        }

        this.history.unshift({
          id: Date.now().toString(),
          timestamp: Date.now(),
          text: currentText
        });

        if (this.history.length > (this.config.maxHistorySize || 100)) {
          this.history.pop();
        }

        let logText = currentText.replace(/\n/g, ' ');
        if (logText.length > 50) logText = logText.substring(0, 50) + '...';
        
        if (/[A-Za-z0-9-_]{25,}/.test(currentText) || /(password|contrase\u00f1a|token|secret|key)/i.test(currentText)) {
          logText = '***[INFORMACIÓN_SENSIBLE_OCULTA]***';
        }

        console.log(`[ClipboardAIAssistant] Nuevo texto copiado: ${logText}`);
        this.emit('new-clipboard-item', this.history[0]);
      }
    } catch (err) {
      // Silenciar errores menores de lectura
    }
  }

  public getHistory(): ClipboardItem[] {
    return this.history;
  }

  public async searchClipboardHistory(query: string): Promise<string> {
    if (this.history.length === 0) {
      console.log(`[ClipboardAIAssistant] Búsqueda "${query}" rechazada: historial vacío.`);
      return "El portapapeles está vacío. No hay nada guardado aún.";
    }

    console.log(`[ClipboardAIAssistant] Buscando en portapapeles: "${query}"...`);

    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const historyContext = this.history.map((item, index) => `[ITEM ${index}]:\n${item.text}\n`).join('\n');
        
        const prompt = `Actúa como un asistente que busca información en el historial del portapapeles.
El usuario está buscando: "${query}"

A continuación tienes el historial reciente del portapapeles (máximo 100 elementos):
${historyContext}

Tu tarea: Encuentra el ítem que MEJOR responda a la búsqueda del usuario.
Si encuentras un ítem que coincide, devuelve ÚNICAMENTE el texto original exacto de ese ítem, sin agregar comillas, saludos ni explicaciones.
Si ninguno coincide razonablemente con la búsqueda, responde exactamente la palabra: "NO_MATCH"`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        if (responseText && responseText !== "NO_MATCH") {
          this.logSearchResult(query, responseText);
          return responseText;
        }
      } catch (err: any) {
        console.error('[ClipboardAIAssistant] Error en búsqueda con LLM:', err.message);
      }
    }

    // Fallback por palabras clave
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length > 0) {
      const matches = this.history.filter(item => {
        const lowerText = item.text.toLowerCase();
        return terms.every(term => lowerText.includes(term));
      });

      if (matches.length > 0) {
        const bestMatch = matches[0].text;
        this.logSearchResult(query, bestMatch);
        return bestMatch;
      }

      for (const item of this.history) {
        const lowerText = item.text.toLowerCase();
        if (terms.some(term => lowerText.includes(term) && term.length > 4)) {
          this.logSearchResult(query, item.text);
          return item.text;
        }
      }
    }

    console.log(`[ClipboardAIAssistant] No se encontraron resultados para "${query}".`);
    return "No se encontró información que coincida con la búsqueda en el portapapeles.";
  }

  private logSearchResult(query: string, resultText: string) {
    let logResult = resultText.replace(/\n/g, ' ');
    if (logResult.length > 50) logResult = logResult.substring(0, 50) + '...';
    
    if (/(password|contrase\u00f1a|token|api_key|secret|bearer|tarjeta|cvv|clave)/i.test(query) || /[A-Za-z0-9-_]{25,}/.test(resultText)) {
      logResult = '***[SENSIBLE_MASKED]***';
    }
    console.log(`[ClipboardAIAssistant] Resultado encontrado para "${query}": ${logResult}`);
  }
}

// ─── Declaración de Herramienta para WhatsApp ────────────────────────

export const searchClipboardToolDeclaration = {
  name: 'search_clipboard_history',
  description: 'Busca inteligentemente en el historial reciente de textos copiados al portapapeles de la computadora. Útil si el usuario pide "el link de zoom que copié", "la contraseña que copié hace rato", o "el correo que estaba viendo".',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      query: { type: 'STRING' as const, description: 'La descripción en lenguaje natural de lo que se busca (ej: "el link de zoom", "el correo de juan", "la contraseña del wifi").' },
    },
    required: ['query'],
  },
};

export async function handleSearchClipboardTool(assistant: ClipboardAIAssistant, args: Record<string, any>) {
  if (!args.query) {
    throw new Error('Debes proporcionar el parámetro query.');
  }
  const result = await assistant.searchClipboardHistory(args.query);
  return { success: true, data: result };
}
