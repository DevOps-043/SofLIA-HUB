import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Intentar usar better-sqlite3 para la DB local si está disponible.
let Database: any = null;
try {
  Database = require('better-sqlite3');
} catch {
  // Ignorar si no está instalado
}

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.md': 'text/markdown',
  '.json': 'application/json',
};

class FileRetriever {
  private baseDirs: string[];

  constructor() {
    const home = os.homedir();
    // Carpetas comunes de Windows/Mac/Linux
    this.baseDirs = [
      path.join(home, 'Documents'),
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
      path.join(home, 'OneDrive', 'Documentos'),
      path.join(home, 'OneDrive', 'Escritorio'),
      path.join(home, 'Documentos'),
      path.join(home, 'Descargas'),
      path.join(home, 'Escritorio')
    ];
  }

  public async searchFile(query: string): Promise<string | null> {
    const normalizedQuery = query.toLowerCase().trim();

    // 1. Intentar buscar en FTS5 de SQLite local (si existe tabla de índices)
    if (Database) {
      const dbPath = path.join(os.homedir(), '.soflia', 'index.db');
      if (fs.existsSync(dbPath)) {
        try {
          const db = new Database(dbPath, { readonly: true });
          const row = db.prepare(`
            SELECT path FROM files_fts 
            WHERE name MATCH ? 
            ORDER BY rank LIMIT 1
          `).get(`*${normalizedQuery}*`) as { path: string } | undefined;
          db.close();
          if (row && fs.existsSync(row.path)) {
            return row.path;
          }
        } catch (e) {
          // Si falla (ej: no existe tabla), continuamos con escaneo fs
        }
      }
    }

    // 2. Escaneo recursivo limitado en las carpetas principales
    for (const baseDir of this.baseDirs) {
      if (!fs.existsSync(baseDir)) continue;
      const found = this.recursiveSearch(baseDir, normalizedQuery, 0, 4);
      if (found) return found;
    }

    return null;
  }

  private recursiveSearch(dir: string, query: string, currentDepth: number, maxDepth: number): string | null {
    if (currentDepth > maxDepth) return null;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    // Priorizar coincidencias de archivos en este nivel
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().includes(query)) {
        return path.join(dir, entry.name);
      }
    }

    // Buscar recursivamente en subdirectorios
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = this.recursiveSearch(path.join(dir, entry.name), query, currentDepth + 1, maxDepth);
        if (found) return found;
      }
    }

    return null;
  }

  public async prepareFileForWhatsApp(filePath: string): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Determinar mimetype exacto
    let mimetype = MIME_TYPES[ext] || 'application/octet-stream';

    // Usar mime-types si está disponible (como lo requiere el plan)
    try {
      // @ts-ignore
      const mime = await import('mime-types');
      if (mime && mime.lookup) {
        const lookupResult = mime.lookup(filePath);
        if (lookupResult) mimetype = lookupResult;
      }
    } catch {
      // Fallback a mapa local si la librería no está disponible
    }

    return {
      buffer,
      mimetype,
      filename: path.basename(filePath)
    };
  }
}

/**
 * Exportar el ToolSchema compatible con el hub de WhatsApp/MCPManager.
 */
export const retrieveLocalFileTool = {
  name: 'retrieve_local_file',
  description: 'Busca un documento en la PC por nombre o contenido parcial, y lo empaqueta con el MIME type correcto para ser enviado por WhatsApp.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre o concepto parcial del archivo a buscar (ej: "reporte", "factura").' }
    },
    required: ['query']
  },
  handler: async (args: { query: string }) => {
    try {
      if (!args.query || typeof args.query !== 'string') {
        throw new Error('El parámetro "query" es requerido y debe ser texto.');
      }

      const retriever = new FileRetriever();
      const filePath = await retriever.searchFile(args.query);

      if (!filePath) {
        return { 
          success: false, 
          error: `No se encontró ningún archivo que coincida con "${args.query}" en Descargas, Documentos o Escritorio.` 
        };
      }

      const fileData = await retriever.prepareFileForWhatsApp(filePath);

      return {
        success: true,
        message: `Archivo "${fileData.filename}" encontrado y preparado.`,
        data: {
          filePath,
          filename: fileData.filename,
          mimetype: fileData.mimetype,
          base64: fileData.buffer.toString('base64'),
          // Directiva para el WhatsApp Hub
          whatsappDirective: {
            action: 'send_document',
            mimetype: fileData.mimetype,
            filename: fileData.filename
          }
        }
      };
    } catch (err: any) {
      return { success: false, error: `Error recuperando el archivo: ${err.message}` };
    }
  }
};
