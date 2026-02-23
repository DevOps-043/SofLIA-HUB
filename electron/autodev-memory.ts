import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ReasoningLog {
  timestamp: string;
  content: string;
}

export interface SessionSummary {
  goal: string;
  outcome: string;
}

export class FileMemoryService {
  private memoryDir: string;

  constructor() {
    // Definir el directorio local: ~/.soflia/memory
    this.memoryDir = path.join(os.homedir(), '.soflia', 'memory');
  }

  /**
   * Asegura que el directorio de memoria exista.
   */
  private async ensureMemoryDir(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
    } catch (error) {
      console.error('Error al crear el directorio de memoria:', error);
      throw error;
    }
  }

  /**
   * Crea y escribe un archivo Markdown estructurado con los datos de la sesión.
   * 
   * @param sessionId Identificador de la sesión
   * @param reasoningLogs Array con los logs de razonamiento del agente
   * @param summary Resumen con el objetivo y resultado de la sesión
   */
  public async flushToMarkdown(
    sessionId: string,
    reasoningLogs: ReasoningLog[],
    summary: SessionSummary
  ): Promise<void> {
    await this.ensureMemoryDir();
    
    const filePath = path.join(this.memoryDir, `session_${sessionId}.md`);
    
    const logsContent = reasoningLogs
      .map((log) => `### [${log.timestamp}]\n${log.content}`)
      .join('\n\n');

    const markdown = `# Memoria de Sesión: ${sessionId}\n\n## Objetivo\n${summary.goal}\n\n## Resultado\n${summary.outcome}\n\n## Logs de Razonamiento\n${logsContent}\n`;

    await fs.writeFile(filePath, markdown, 'utf-8');
  }

  /**
   * Extrae el texto de un archivo de memoria previo para que el agente
   * lo pueda usar a través de sus herramientas de lectura.
   * 
   * @param sessionId Identificador de la sesión a leer
   * @returns El contenido del archivo en formato string
   */
  public async readSessionMarkdown(sessionId: string): Promise<string> {
    const filePath = path.join(this.memoryDir, `session_${sessionId}.md`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`No se encontró memoria para la sesión: ${sessionId}`);
      }
      throw error;
    }
  }
}
