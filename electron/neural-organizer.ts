import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Tesseract from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const NEURAL_ORGANIZER_TOOLS = {
  functionDeclarations: [
    {
      name: 'neural_organizer_status',
      description: 'Obtiene el estado del Organizador Neuronal (si está vigilando la carpeta de descargas y cuántos archivos ha procesado).',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'neural_organizer_toggle',
      description: 'Activa o desactiva el Organizador Neuronal de archivos.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enable: { type: 'BOOLEAN' as const, description: 'true para activar, false para desactivar.' },
        },
        required: ['enable'],
      },
    }
  ]
};

export interface NeuralOrganizerOptions {
  apiKey: string;
  notifyCallback?: (message: string) => Promise<void>;
}

export class NeuralOrganizerService {
  private watcher: fs.FSWatcher | null = null;
  private isRunning = false;
  private processingFiles = new Set<string>();
  private ai: GoogleGenerativeAI;
  private notifyCallback?: (message: string) => Promise<void>;
  private downloadsPath: string;
  private processedCount = 0;

  constructor(options: NeuralOrganizerOptions) {
    this.ai = new GoogleGenerativeAI(options.apiKey);
    this.notifyCallback = options.notifyCallback;
    this.downloadsPath = path.join(os.homedir(), 'Downloads');
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true });
    }

    this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
      if (eventType === 'rename' && filename) {
        this.handleNewFile(filename).catch((err: Error) => {
          console.error('[NeuralOrganizer] Error handling file:', filename, err.message);
        });
      }
    });
    console.log(`[NeuralOrganizer] Watching for new files in ${this.downloadsPath}`);
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isRunning = false;
    this.processingFiles.clear();
    console.log('[NeuralOrganizer] Stopped watching');
  }

  public updateApiKey(apiKey: string): void {
    this.ai = new GoogleGenerativeAI(apiKey);
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      downloadsPath: this.downloadsPath,
      processedFilesCount: this.processedCount,
      processingNow: this.processingFiles.size
    };
  }

  public handleToolCall(toolName: string, args: any): any {
    if (toolName === 'neural_organizer_status') {
      return { success: true, status: this.getStatus() };
    }
    if (toolName === 'neural_organizer_toggle') {
      if (args.enable) {
        this.start();
        return { success: true, message: 'Organizador Neuronal activado. Ahora vigilaré la carpeta de descargas.' };
      } else {
        this.stop();
        return { success: true, message: 'Organizador Neuronal desactivado.' };
      }
    }
    throw new Error(`Tool ${toolName} not supported by NeuralOrganizerService`);
  }

  private async handleNewFile(filename: string): Promise<void> {
    if (filename.endsWith('.crdownload') || filename.endsWith('.tmp') || filename.startsWith('.')) {
      return;
    }

    const filePath = path.join(this.downloadsPath, filename);
    
    if (this.processingFiles.has(filePath)) {
      return;
    }

    const isReady = await this.waitForFileReady(filePath);
    if (!isReady) {
      return;
    }

    this.processingFiles.add(filePath);

    try {
      let extractedText = '';
      const ext = path.extname(filename).toLowerCase();
      
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        try {
          console.log(`[NeuralOrganizer] Extracting text from image: ${filename}`);
          const { data: { text } } = await Tesseract.recognize(filePath, 'spa');
          extractedText = text.trim();
        } catch (ocrErr: any) {
          console.error(`[NeuralOrganizer] OCR Error for ${filename}:`, ocrErr.message);
        }
      }

      const categoryInfo = await this.categorizeFile(filename, extractedText);
      
      const docPath = path.join(os.homedir(), 'Documents');
      const categoryPath = path.join(docPath, categoryInfo.category);
      
      await fs.promises.mkdir(categoryPath, { recursive: true, mode: 0o700 });

      let newFileName = filename;
      let destPath = path.join(categoryPath, newFileName);
      
      if (fs.existsSync(destPath)) {
        const nameWithoutExt = path.basename(filename, ext);
        newFileName = `${nameWithoutExt}_${Date.now()}${ext}`;
        destPath = path.join(categoryPath, newFileName);
      }

      await fs.promises.rename(filePath, destPath);
      console.log(`[NeuralOrganizer] Moved ${filename} to ${destPath}`);
      this.processedCount++;

      if (this.notifyCallback) {
        const msg = `📁 *Archivo Organizado Automáticamente*\n*Nombre:* ${newFileName}\n*Categoría:* ${categoryInfo.category}\n*Resumen:* ${categoryInfo.summary}\n*Ubicación:* Documentos/${categoryInfo.category}`;
        await this.notifyCallback(msg);
      }

    } catch (err: any) {
      console.error(`[NeuralOrganizer] Failed to process ${filename}:`, err.message);
    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  private async waitForFileReady(filePath: string, maxAttempts = 15): Promise<boolean> {
    let attempts = 0;
    let lastSize = -1;
    let lastMtime = 0;
    let stableCount = 0;

    while (attempts < maxAttempts) {
      try {
        const stats = await fs.promises.stat(filePath);
        
        if (stats.size > 0 && stats.size === lastSize && stats.mtimeMs === lastMtime) {
          stableCount++;
          if (stableCount >= 2) {
            return true;
          }
        } else {
          stableCount = 0;
        }

        lastSize = stats.size;
        lastMtime = stats.mtimeMs;
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return false;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      attempts++;
    }

    return false;
  }

  private async categorizeFile(filename: string, extractedText: string): Promise<{ category: string; summary: string }> {
    const model = this.ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const prompt = `
Analiza el siguiente archivo para categorizarlo.
Nombre del archivo: "${filename}"
${extractedText ? `Texto extraído (OCR): "${extractedText.substring(0, 1500)}"` : ''}

Devuelve un JSON estricto con la siguiente estructura:
{
  "category": "Una de: Facturas|Trabajo|Personal|Software|Otros",
  "summary": "Un resumen muy corto (max 15 palabras) de qué trata el archivo basado en el nombre y texto."
}
`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);
      
      const validCategories = ['Facturas', 'Trabajo', 'Personal', 'Software', 'Otros'];
      let category = parsed.category;
      if (!validCategories.includes(category)) {
        category = 'Otros';
      }

      return {
        category,
        summary: parsed.summary || 'Sin resumen',
      };
    } catch (err: any) {
      console.error('[NeuralOrganizer] LLM Categorization failed:', err.message);
      return { category: 'Otros', summary: 'Error al categorizar' };
    }
  }
}
