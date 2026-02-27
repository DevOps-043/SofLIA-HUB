import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SearchResult {
  filepath: string;
  filename: string;
  extract: string;
}

export interface IndexerStats {
  totalFiles: number;
  dbSizeBytes: number;
  lastIndexed: Date | null;
}

export class SemanticIndexer {
  private db: BetterSqlite3Database;
  private isIndexing: boolean = false;
  private lastIndexed: Date | null = null;
  private daemonInterval: NodeJS.Timeout | null = null;
  private readonly dbPath: string;
  
  // Exclude node_modules, build artifacts, and hidden directories to speed up indexing
  private readonly EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage'];
  
  // Supported source code and text formats
  private readonly SUPPORTED_EXTENSIONS = [
    '.txt', '.md', '.json', '.ts', '.tsx', '.js', '.jsx', 
    '.csv', '.log', '.html', '.css', '.scss', '.yaml', '.yml'
  ];

  private static instance: SemanticIndexer;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.sofia-semantic-indexer.db');
    
    // Initialize DB with proper settings
    this.db = new Database(this.dbPath);
    
    // Set pragmas for better performance and reliability
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    
    this.initializeSchema();
  }

  public static getInstance(dbPath?: string): SemanticIndexer {
    if (!SemanticIndexer.instance) {
      SemanticIndexer.instance = new SemanticIndexer(dbPath);
    }
    return SemanticIndexer.instance;
  }

  private initializeSchema(): void {
    try {
      // FTS5 table for full-text search. 'filepath' is unindexed to save space and avoid matching paths natively.
      // 'tokenize="porter"' enables Porter stemming for English words (e.g., 'running' matches 'run').
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
          filepath UNINDEXED,
          filename,
          content,
          tokenize="porter"
        );
      `);
      console.log('[SemanticIndexer] Schema initialized successfully');
    } catch (error) {
      console.error('[SemanticIndexer] Error initializing schema:', error);
      throw error;
    }
  }

  /**
   * Recursively crawls directories avoiding excluded paths.
   */
  private async walkDirectory(dir: string, fileList: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Ignore hidden folders and common heavy build folders
          if (this.EXCLUDED_DIRS.includes(entry.name) || entry.name.startsWith('.')) {
            continue;
          }
          await this.walkDirectory(fullPath, fileList);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.SUPPORTED_EXTENSIONS.includes(ext)) {
            fileList.push(fullPath);
          }
        }
      }
    } catch (err) {
      console.warn(`[SemanticIndexer] Failed to read directory ${dir}:`, err);
    }
    return fileList;
  }

  /**
   * Reads a portion of the file content safely to avoid memory explosion with giant files.
   */
  private async readFileContent(filePath: string, maxChars: number = 2000): Promise<string> {
    let fileHandle: fs.promises.FileHandle | null = null;
    try {
      fileHandle = await fs.promises.open(filePath, 'r');
      const stat = await fileHandle.stat();
      
      if (stat.size === 0) return '';
      
      const readSize = Math.min(stat.size, maxChars);
      const buffer = Buffer.alloc(readSize);
      
      const { bytesRead } = await fileHandle.read(buffer, 0, readSize, 0);
      
      let content = buffer.toString('utf-8', 0, bytesRead);
      // Clean null bytes which might corrupt SQLite or cause parsing issues
      content = content.replace(/\u0000/g, '').trim(); 
      return content;
    } catch (error) {
      console.warn(`[SemanticIndexer] Error reading file ${filePath}:`, error);
      return '';
    } finally {
      if (fileHandle) {
        await fileHandle.close();
      }
    }
  }

  /**
   * Starts the indexing process for a given directory.
   */
  public async indexDirectory(dir: string): Promise<void> {
    if (this.isIndexing) {
      console.log('[SemanticIndexer] Indexing already in progress. Skipping...');
      return;
    }
    
    this.isIndexing = true;
    console.log(`[SemanticIndexer] Starting indexing for directory: ${dir}`);
    
    try {
      if (!fs.existsSync(dir)) {
         throw new Error(`Directory does not exist: ${dir}`);
      }

      const files = await this.walkDirectory(dir);
      console.log(`[SemanticIndexer] Found ${files.length} supported files to index.`);
      
      const stmtDelete = this.db.prepare('DELETE FROM docs WHERE filepath = ?');
      const stmtInsert = this.db.prepare('INSERT INTO docs (filepath, filename, content) VALUES (?, ?, ?)');
      
      // Batch updates within a transaction for immense performance boost
      const insertMany = this.db.transaction((docs: {filepath: string, filename: string, content: string}[]) => {
        for (const doc of docs) {
          stmtDelete.run(doc.filepath);
          if (doc.content.trim() !== '') {
            stmtInsert.run(doc.filepath, doc.filename, doc.content);
          }
        }
      });
      
      const BATCH_SIZE = 100;
      let batch = [];
      let indexedCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const filename = path.basename(filePath);
        // Extract only initial snippet of file to keep DB fast and small
        const content = await this.readFileContent(filePath, 2000);
        
        batch.push({ filepath: filePath, filename, content });
        
        if (batch.length >= BATCH_SIZE || i === files.length - 1) {
          insertMany(batch);
          indexedCount += batch.length;
          batch = [];
          // Yield to event loop heavily preventing IPC blocking in Electron
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      this.lastIndexed = new Date();
      console.log(`[SemanticIndexer] Successfully indexed ${indexedCount} files.`);
      
    } catch (error) {
      console.error('[SemanticIndexer] Error during indexing:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Formats user query safely for FTS5 syntax.
   */
  private formatQuery(query: string): string {
    // Strip out FTS5 specific operators that could break syntax if misplaced by user
    return query
      .replace(/["'()*^{}\[\]~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Searches indexed files for matching text using FTS5.
   */
  public search(query: string, limit: number = 10): SearchResult[] {
    try {
      const safeQuery = this.formatQuery(query);
      if (!safeQuery) return [];
      
      // Search across content and filename (1 and 2 mapped columns natively)
      // snippet() pulls context highlighting the search term with [MATCH]
      const stmt = this.db.prepare(`
        SELECT 
          filepath, 
          filename, 
          snippet(docs, 2, '[MATCH]', '[/MATCH]', '...', 64) as extract 
        FROM docs 
        WHERE docs MATCH ? 
        ORDER BY rank 
        LIMIT ?
      `);
      
      const results = stmt.all(safeQuery, limit) as SearchResult[];
      return results;
    } catch (error) {
      console.error(`[SemanticIndexer] Error searching for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Returns current statistics of the database.
   */
  public getStats(): IndexerStats {
    try {
      const stmt = this.db.prepare('SELECT count(*) as count FROM docs');
      const result = stmt.get() as { count: number };
      
      let dbSizeBytes = 0;
      if (fs.existsSync(this.dbPath)) {
        const stats = fs.statSync(this.dbPath);
        dbSizeBytes = stats.size;
      }
      
      return {
        totalFiles: result.count,
        dbSizeBytes,
        lastIndexed: this.lastIndexed
      };
    } catch (error) {
      console.error('[SemanticIndexer] Error getting stats:', error);
      return { totalFiles: 0, dbSizeBytes: 0, lastIndexed: this.lastIndexed };
    }
  }

  /**
   * Initializes an automated background daemon to keep directories up to date.
   */
  public startDaemon(directories: string[], intervalMs: number = 600000): void {
    if (this.daemonInterval) {
      clearInterval(this.daemonInterval);
    }
    
    console.log(`[SemanticIndexer] Starting background daemon. Interval: ${intervalMs}ms`);
    
    // Execute immediately on startup
    this.runDaemon(directories);
    
    // Schedule recurring iterations
    this.daemonInterval = setInterval(() => {
      this.runDaemon(directories);
    }, intervalMs);
  }
  
  /**
   * Stops the background indexing daemon.
   */
  public stopDaemon(): void {
    if (this.daemonInterval) {
      clearInterval(this.daemonInterval);
      this.daemonInterval = null;
      console.log('[SemanticIndexer] Background daemon stopped.');
    }
  }
  
  private async runDaemon(directories: string[]): Promise<void> {
    for (const dir of directories) {
      try {
        await this.indexDirectory(dir);
      } catch (err) {
        console.error(`[SemanticIndexer] Daemon failed to index ${dir}:`, err);
      }
    }
  }

  /**
   * Gracefully shuts down daemon and closes database connections.
   */
  public close(): void {
    this.stopDaemon();
    try {
      this.db.close();
      console.log('[SemanticIndexer] Database connection closed.');
    } catch (err) {
      console.error('[SemanticIndexer] Error closing database:', err);
    }
  }
}
