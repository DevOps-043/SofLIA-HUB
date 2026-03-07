import Database from 'better-sqlite3';
import { z } from 'zod';
import path from 'path';
import { app } from 'electron';

class QuickNotesService {
  private db: Database.Database | null = null;

  constructor() {}

  private getDb(): Database.Database {
    if (!this.db) {
      // Inicialización diferida para asegurar que `app` esté lista (app.getPath('userData'))
      const dbPath = path.join(app.getPath('userData'), 'quick_notes.db');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    return this.db;
  }

  addNote(content: string): number {
    const stmt = this.getDb().prepare('INSERT INTO notes (content) VALUES (?)');
    const info = stmt.run(content);
    return info.lastInsertRowid as number;
  }

  searchNotes(query: string): any[] {
    const stmt = this.getDb().prepare("SELECT id, content, datetime(created_at, 'localtime') as local_created_at FROM notes WHERE content LIKE ? ORDER BY created_at DESC");
    return stmt.all(`%${query}%`);
  }

  listNotes(limit: number = 10): any[] {
    const stmt = this.getDb().prepare("SELECT id, content, datetime(created_at, 'localtime') as local_created_at FROM notes ORDER BY created_at DESC LIMIT ?");
    return stmt.all(limit);
  }

  deleteNote(id: number): boolean {
    const stmt = this.getDb().prepare('DELETE FROM notes WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }
}

const quickNotesService = new QuickNotesService();

export const quickNotesTool = {
  name: 'quick_notes',
  description: 'Herramienta de Segundo Cerebro para guardar, buscar, listar y eliminar notas rápidas o fragmentos de información (links, ideas, recordatorios).',
  schema: z.object({
    action: z.enum(['add', 'search', 'list', 'delete']),
    query: z.string().optional(),
    id: z.number().optional()
  }) as any,
  execute: async (params: { action: 'add' | 'search' | 'list' | 'delete', query?: string, id?: number }) => {
    try {
      const { action, query, id } = params;

      switch (action) {
        case 'add': {
          if (!query) {
            return '❌ Error: Debes proporcionar el contenido de la nota en el parámetro "query" para agregarla.';
          }
          const newId = quickNotesService.addNote(query);
          return `✅ Nota guardada en tu Segundo Cerebro con el ID: ${newId}`;
        }
        
        case 'search': {
          if (!query) {
            return '❌ Error: Debes proporcionar un término de búsqueda en el parámetro "query".';
          }
          const results = quickNotesService.searchNotes(query);
          if (results.length === 0) {
            return `No encontré ninguna nota que coincida con "${query}".`;
          }
          let response = `🔍 Encontré ${results.length} resultado(s) para "${query}":\n\n`;
          results.forEach((note: any) => {
            response += `🔹 [ID: ${note.id}] - ${note.local_created_at}\n${note.content}\n\n`;
          });
          return response.trim();
        }

        case 'list': {
          const limit = query && !isNaN(parseInt(query)) ? parseInt(query) : 10;
          const notes = quickNotesService.listNotes(limit);
          if (notes.length === 0) {
            return 'Tu Segundo Cerebro está vacío actualmente. Usa la acción "add" para guardar información.';
          }
          let response = `📝 Tus últimas ${notes.length} notas:\n\n`;
          notes.forEach((note: any) => {
            response += `🔹 [ID: ${note.id}] - ${note.local_created_at}\n${note.content}\n\n`;
          });
          return response.trim();
        }

        case 'delete': {
          if (id === undefined) {
            return '❌ Error: Debes proporcionar el "id" de la nota que deseas eliminar.';
          }
          const success = quickNotesService.deleteNote(id);
          if (success) {
            return `🗑️ La nota con ID ${id} fue eliminada de tu Segundo Cerebro.`;
          } else {
            return `❌ No encontré ninguna nota con el ID ${id}.`;
          }
        }

        default:
          return `❌ Error: Acción "${action}" no válida. Las acciones permitidas son: add, search, list, delete.`;
      }
    } catch (error: any) {
      return `❌ Error en el Segundo Cerebro: ${error.message}`;
    }
  }
};
