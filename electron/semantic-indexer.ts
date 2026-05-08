import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SUPPORTED_EXTENSIONS } from './semantic-indexer/constants';
import { createIndexerDatabase, getDatabaseSizeBytes, type BetterSqlite3Database } from './semantic-indexer/database';
import { runIndexerDaemon } from './semantic-indexer/daemon';
import { walkDirectory } from './semantic-indexer/file-walker';
import { indexFilesIntoDatabase } from './semantic-indexer/indexing';
import { formatFtsQuery } from './semantic-indexer/query';
import type { IndexerStats, SearchResult } from './semantic-indexer/types';

export type { IndexerStats, SearchResult } from './semantic-indexer/types';

export class SemanticIndexer {
  private db: BetterSqlite3Database;
  private isIndexing = false;
  private lastIndexed: Date | null = null;
  private daemonInterval: NodeJS.Timeout | null = null;
  private readonly dbPath: string;
  private static instance: SemanticIndexer;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.sofia-semantic-indexer.db');
    this.db = createIndexerDatabase(this.dbPath);
  }

  public static getInstance(dbPath?: string): SemanticIndexer {
    if (!SemanticIndexer.instance) {
      SemanticIndexer.instance = new SemanticIndexer(dbPath);
    }
    return SemanticIndexer.instance;
  }

  public async indexDirectory(dir: string): Promise<void> {
    if (this.isIndexing) {
      console.log('[SemanticIndexer] Indexing already in progress. Skipping...');
      return;
    }

    this.isIndexing = true;
    console.log(`[SemanticIndexer] Starting indexing for directory: ${dir}`);

    try {
      if (!fs.existsSync(dir)) throw new Error(`Directory does not exist: ${dir}`);
      const files = await walkDirectory(dir, SUPPORTED_EXTENSIONS);
      console.log(`[SemanticIndexer] Found ${files.length} supported files to index.`);
      const indexedCount = await indexFilesIntoDatabase(this.db, files);
      this.lastIndexed = new Date();
      console.log(`[SemanticIndexer] Successfully indexed ${indexedCount} files.`);
    } catch (error) {
      console.error('[SemanticIndexer] Error during indexing:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  public search(query: string, limit: number = 10): SearchResult[] {
    try {
      const safeQuery = formatFtsQuery(query);
      if (!safeQuery) return [];
      const stmt = this.db.prepare(`
        SELECT filepath, filename, snippet(docs, 2, '[MATCH]', '[/MATCH]', '...', 64) as extract
        FROM docs
        WHERE docs MATCH ?
        ORDER BY rank
        LIMIT ?
      `);
      return stmt.all(safeQuery, limit) as SearchResult[];
    } catch (error) {
      console.error(`[SemanticIndexer] Error searching for query "${query}":`, error);
      return [];
    }
  }

  public getStats(): IndexerStats {
    try {
      const result = this.db.prepare('SELECT count(*) as count FROM docs').get() as { count: number };
      return { totalFiles: result.count, dbSizeBytes: getDatabaseSizeBytes(this.dbPath), lastIndexed: this.lastIndexed };
    } catch (error) {
      console.error('[SemanticIndexer] Error getting stats:', error);
      return { totalFiles: 0, dbSizeBytes: 0, lastIndexed: this.lastIndexed };
    }
  }

  public startDaemon(directories: string[], intervalMs: number = 600000): void {
    if (this.daemonInterval) clearInterval(this.daemonInterval);
    console.log(`[SemanticIndexer] Starting background daemon. Interval: ${intervalMs}ms`);
    void this.runDaemonCycle(directories);
    this.daemonInterval = setInterval(() => void this.runDaemonCycle(directories), intervalMs);
  }

  public stopDaemon(): void {
    if (!this.daemonInterval) return;
    clearInterval(this.daemonInterval);
    this.daemonInterval = null;
    console.log('[SemanticIndexer] Background daemon stopped.');
  }

  private runDaemonCycle(directories: string[]): Promise<void> {
    return runIndexerDaemon(directories, (dir) => this.indexDirectory(dir));
  }

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
