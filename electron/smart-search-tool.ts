import { SemanticIndexer } from './semantic-indexer';
import { formatSemanticSearchResults } from './smart-search/result-format';

export { semanticFileSearchDeclaration } from './smart-search/declaration';

export class SmartSearchTool {
  private indexer: SemanticIndexer;

  constructor(indexer?: SemanticIndexer) {
    this.indexer = indexer || SemanticIndexer.getInstance();
  }

  public searchFiles(query: string, maxResults: number = 3) {
    try {
      if (!query || query.trim() === '') {
        return { success: false, error: 'El parametro query no puede estar vacio.' };
      }

      console.log(`[SmartSearchTool] Ejecutando consulta SQL FTS5 para: "${query}" (Limite: ${maxResults})`);
      const rawResults = this.indexer.search(query, maxResults);
      if (!rawResults || rawResults.length === 0) {
        return {
          success: true,
          message: `No se encontraron documentos indexados que coincidan con la busqueda: "${query}".`,
          results: [],
        };
      }

      const results = formatSemanticSearchResults(rawResults);
      return {
        success: true,
        message: `Busqueda semantica FTS5 completada. Se encontraron ${results.length} documentos relevantes.`,
        results,
      };
    } catch (error: any) {
      console.error(`[SmartSearchTool] Error al buscar archivos para la consulta "${query}":`, error.message);
      return { success: false, error: `Ocurrio un error inesperado al ejecutar la busqueda SQL FTS5: ${error.message}` };
    }
  }

  public async indexTargetDirectory(directoryPath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`[SmartSearchTool] Indexando directorio proactivamente: ${directoryPath}`);
      await this.indexer.indexDirectory(directoryPath);
      return { success: true, message: `El directorio ${directoryPath} ha sido indexado y esta listo para busquedas semanticas.` };
    } catch (error: any) {
      console.error('[SmartSearchTool] Error al indexar:', error.message);
      return { success: false, error: `Fallo la indexacion del directorio: ${error.message}` };
    }
  }

  public getHealthStats() {
    try {
      const stats = this.indexer.getStats();
      return {
        success: true,
        total_files_indexed: stats.totalFiles,
        db_size_bytes: stats.dbSizeBytes,
        last_indexed: stats.lastIndexed,
      };
    } catch (error: any) {
      return { success: false, error: `No se pudieron obtener estadisticas del SemanticIndexer: ${error.message}` };
    }
  }
}
