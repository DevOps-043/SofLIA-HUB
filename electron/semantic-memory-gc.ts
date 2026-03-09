/**
 * SemanticMemoryGC — Recolector de Basura Inteligente para Memoria Semántica.
 * 
 * Este servicio opera como un Garbage Collector semántico para el vector store local.
 * Su objetivo no es eliminar datos, sino CONSOLIDARLOS. Busca fragmentos dispersos
 * de conversaciones mayores a 30 días, los envía a Gemini Flash para generar un 
 * resumen denso de alta prioridad (Memory Card), lo indexa como un vector nuevo, 
 * y descarta en cascada los fragmentos obsoletos originales (ahorrando tokens).
 */
import { EventEmitter } from 'node:events';
import { app, safeStorage, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GCResult {
  success: boolean;
  compacted: number;
  message: string;
  error?: string;
}

export class SemanticMemoryGC extends EventEmitter {
  private db: Database.Database | null = null;
  private apiKey: string = '';
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(apiKey: string = '') {
    super();
    this.apiKey = apiKey;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Inicializa la conexión a la base de datos de memoria semántica compartida.
   * Reutiliza la configuración WAL y SQLCipher de MemoryService para evitar bloqueos.
   */
  async init(): Promise<void> {
    try {
      const DB_PATH = path.join(app.getPath('userData'), 'soflia-memory.db');
      this.db = new Database(DB_PATH);
      
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000'); // Timeout generoso para concurrencia

      // Recuperar clave de encriptación de SQLCipher (misma lógica que MemoryService)
      const keyPath = path.join(app.getPath('userData'), 'soflia-memory.key');
      let dbKey = '';

      if (fs.existsSync(keyPath)) {
        const encryptedKey = fs.readFileSync(keyPath);
        if (safeStorage.isEncryptionAvailable()) {
          try {
            dbKey = safeStorage.decryptString(encryptedKey);
          } catch (e) {
            console.warn('[SemanticMemoryGC] Fallback to unencrypted DB key');
            dbKey = encryptedKey.toString('utf8');
          }
        } else {
          dbKey = encryptedKey.toString('utf8');
        }
      }
      
      if (dbKey) {
        this.db.pragma(`key = '${dbKey}'`);
      }
      
      console.log('[SemanticMemoryGC] Servicio inicializado correctamente y conectado a DB.');
    } catch (err: any) {
      console.error('[SemanticMemoryGC] Error al inicializar DB:', err.message);
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Ejecutar diariamente el Garbage Collector en segundo plano
    this.intervalId = setInterval(() => {
      this.scanObsoleteMemories().catch(err => 
        console.error('[SemanticMemoryGC] Error en ciclo programado:', err.message)
      );
    }, 24 * 60 * 60 * 1000);
    
    console.log('[SemanticMemoryGC] Recolector de basura programado iniciado (intervalo 24h).');
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    console.log('[SemanticMemoryGC] Servicio detenido.');
  }

  getStatus(): { running: boolean; hasDb: boolean } {
    return {
      running: this.isRunning,
      hasDb: this.db !== null,
    };
  }

  /**
   * Escanea y consolida los recuerdos (memory_chunks) obsoletos.
   * Identifica registros con más de 30 días, los agrupa por sesión, 
   * y usa Gemini Flash para destilarlos en conocimiento de alta densidad.
   */
  scanObsoleteMemories = async (): Promise<GCResult> => {
    if (!this.db || !this.apiKey) {
      return { success: false, compacted: 0, message: 'DB o API Key no inicializada' };
    }

    try {
      // Filtro de obsolescencia: 30 días en milisegundos
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);

      const rows = this.db.prepare(`
        SELECT id, session_key, phone_number, chunk_text, source_start_time 
        FROM memory_chunks 
        WHERE source_start_time < ? AND source_type IN ('conversation', 'summary')
        ORDER BY source_start_time ASC
        LIMIT 200
      `).all(cutoff) as Array<{ id: number; session_key: string; phone_number: string; chunk_text: string; source_start_time: number }>;

      if (rows.length === 0) {
        return { success: true, compacted: 0, message: 'No hay recuerdos obsoletos pendientes.' };
      }

      // Agrupar los chunks por sesión para que el LLM tenga contexto hilado del usuario
      const bySession = new Map<string, Array<any>>();
      for (const row of rows) {
        if (!bySession.has(row.session_key)) {
          bySession.set(row.session_key, []);
        }
        bySession.get(row.session_key)!.push(row);
      }

      let totalCompacted = 0;
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

      for (const [sessionKey, chunks] of bySession.entries()) {
        // Unir todos los fragmentos dispersos con estampa de tiempo
        const textToSummarize = chunks.map(c => `[Fecha: ${new Date(c.source_start_time).toISOString()}] ${c.chunk_text}`).join('\n\n');
        
        const prompt = `Actúa como un archivista de IA. Resume estos hechos aislados extraídos de la memoria a largo plazo de un usuario en un solo párrafo consolidado de alta densidad de información.\nDescarta trivialidades, saludos y cháchara. Conserva ÚNICAMENTE: lecciones aprendidas, preferencias del usuario, decisiones tomadas y datos técnicos clave.\n\nTEXTOS AISLADOS OBSOLETOS:\n${textToSummarize}`;

        try {
          const result = await model.generateContent(prompt);
          const newSummary = result.response.text().trim();

          if (newSummary) {
            const oldIds = chunks.map(c => c.id);
            // Generar nuevo vector para el resumen compactado
            const embedResult = await embeddingModel.embedContent(newSummary);
            const embedding = embedResult.embedding.values;

            const phoneNumber = chunks[0].phone_number;
            const startTime = chunks[0].source_start_time;

            await this.consolidateTransaction(oldIds, newSummary, sessionKey, phoneNumber, embedding, startTime);
            totalCompacted += oldIds.length;
          }
        } catch (err: any) {
          console.error(`[SemanticMemoryGC] Error resumiendo sesión ${sessionKey}:`, err.message);
        }
      }

      this.emit('gc-completed', { compacted: totalCompacted });
      return { 
        success: true, 
        compacted: totalCompacted, 
        message: `Compresión exitosa: ${totalCompacted} vectores obsoletos consolidados.` 
      };
    } catch (err: any) {
      console.error('[SemanticMemoryGC] scanObsoleteMemories error:', err.message);
      return { success: false, compacted: 0, message: err.message, error: err.message };
    }
  }

  /**
   * Ejecuta la eliminación (oldIds) y la inserción (nuevo resumen) 
   * de manera atómica como una única transacción ACID en SQLite.
   */
  consolidateTransaction = async (
    oldIds: number[], 
    newSummary: string, 
    sessionKey: string,
    phoneNumber: string,
    embedding: number[],
    startTime: number
  ): Promise<void> => {
    if (!this.db) return;

    const transaction = this.db.transaction(() => {
      // 1. Insertar el nuevo resumen denso como vector fresco
      this.db!.prepare(`
        INSERT INTO memory_chunks (session_key, phone_number, chunk_text, embedding, source_type, source_start_time, source_end_time)
        VALUES (?, ?, ?, ?, 'summary', ?, ?)
      `).run(
        sessionKey,
        phoneNumber,
        newSummary,
        JSON.stringify(embedding),
        startTime,
        Date.now()
      );

      // 2. Eliminar en cascada los vectores viejos y redundantes
      const placeholders = oldIds.map(() => '?').join(',');
      this.db!.prepare(`DELETE FROM memory_chunks WHERE id IN (${placeholders})`).run(...oldIds);
    });

    try {
      transaction();
      console.log(`[SemanticMemoryGC] Consolidó ${oldIds.length} recuerdos en 1 resumen denso para ${sessionKey}`);
    } catch (err: any) {
      console.error(`[SemanticMemoryGC] Error en la transacción de base de datos:`, err.message);
      throw err;
    }
  }

  /**
   * Comando manual para ser invocado por WhatsApp Dispatcher u otras herramientas.
   * Permite al usuario forzar la limpieza enviando "/comprimir_memoria".
   */
  async executeManualCommand(): Promise<string> {
    const result = await this.scanObsoleteMemories();
    if (result.success) {
      if (result.compacted === 0) {
        return "🧠 La memoria semántica está optimizada. No hay recuerdos viejos que comprimir por ahora.";
      }
      return `🧹 *Memoria Semántica Optimizada*\nSe consolidaron ${result.compacted} recuerdos aislados en resúmenes de alta densidad, ahorrando tokens y mejorando mi contexto.`;
    } else {
      return `❌ Error al comprimir la memoria: ${result.error || result.message}`;
    }
  }
}

/**
 * Wrapper para inyectar los handlers IPC, exponiendo controles manuales
 * para forzar el recolector de basura desde el Frontend en un futuro.
 */
export function registerGCHandlers(gcService: SemanticMemoryGC) {
  ipcMain.handle('memory:run-gc', async () => {
    try {
      const result = await gcService.scanObsoleteMemories();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('memory:gc-status', () => {
    return { success: true, data: gcService.getStatus() };
  });
}

/**
 * Export Dinámico ToolSchema (para MCPManager / Sistemas Autónomos)
 * Permite que SofLIA ejecute este recolector como una acción proactiva.
 */
export const MemoryGCTool = {
  name: 'comprimir_memoria',
  description: 'Ejecuta el recolector de basura semántico. Consolida recuerdos viejos recurrentes (>30 días) para ahorrar tokens y mejorar precisión.',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async () => {
    const apiKey = process.env.VITE_GEMINI_API_KEY || '';
    const gc = new SemanticMemoryGC(apiKey);
    await gc.init();
    const result = await gc.executeManualCommand();
    gc.stop();
    return result;
  }
};
