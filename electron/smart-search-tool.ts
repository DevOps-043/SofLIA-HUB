import { SemanticIndexer } from './semantic-indexer';

/**
 * 6. ToolDeclaration 'semantic_file_search' para recuperar documentos olvidados usando descripciones naturales
 * Se exporta para inyectarlo en las capacidades del WhatsAppAgent o cualquier agente (AutoDev/DesktopAgent).
 */
export const semanticFileSearchDeclaration = {
  name: 'semantic_file_search',
  description: 'Busca archivos olvidados en la computadora por su CONTENIDO o descripción natural usando búsqueda semántica de texto completo (FTS5). Ideal para recuperar documentos cuando el usuario no recuerda el nombre del archivo pero sí de qué trata (ej. "el reporte donde hablo de las ventas de marzo" o "encuentra el contrato de arrendamiento").',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      query: { 
        type: 'STRING' as const, 
        description: 'Frase, palabras clave o tema a buscar dentro del contenido de los documentos. Usa palabras relevantes para mejorar la precisión FTS5.' 
      },
      max_results: { 
        type: 'NUMBER' as const, 
        description: 'Número máximo de resultados a devolver. Por defecto es 3.' 
      }
    },
    required: ['query']
  }
};

/**
 * 2. Crear clase SmartSearchTool
 * Controlador y wrapper que orquesta la búsqueda semántica integrada con el ecosistema del agente.
 */
export class SmartSearchTool {
  // 1. Inyectar el repositorio de base de datos / SemanticIndexer existente
  private indexer: SemanticIndexer;

  constructor(indexer?: SemanticIndexer) {
    this.indexer = indexer || SemanticIndexer.getInstance();
  }

  /**
   * 3. Método searchFiles(query: string, maxResults: number = 3)
   * Realiza la búsqueda semántica en los archivos indexados.
   */
  public searchFiles(query: string, maxResults: number = 3) {
    try {
      if (!query || query.trim() === '') {
        return { 
          success: false, 
          error: 'El parámetro query no puede estar vacío.' 
        };
      }

      console.log(`[SmartSearchTool] Ejecutando consulta SQL FTS5 para: "${query}" (Límite: ${maxResults})`);
      
      // 4. Ejecutar consulta SQL FTS5 contra la tabla de documentos indexados
      // El método search internamente ejecuta: SELECT filepath, filename, snippet(...) FROM docs WHERE docs MATCH ?
      const rawResults = this.indexer.search(query, maxResults);

      if (!rawResults || rawResults.length === 0) {
        return {
          success: true,
          message: `No se encontraron documentos indexados que coincidan con la búsqueda: "${query}".`,
          results: []
        };
      }

      // 5. Formatear la respuesta con ruta del archivo y un snippet del contenido encontrado
      const formattedResults = rawResults.map((res) => {
        // Los snippets de FTS5 vienen con marcadores [MATCH] (configurados en SemanticIndexer)
        // Los reemplazamos por algo más estético y fácil de digerir por el LLM.
        const cleanSnippet = res.extract
          .replace(/\[MATCH\]/g, '👉')
          .replace(/\[\/MATCH\]/g, '👈')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          file_name: res.filename,
          file_path: res.filepath,
          content_snippet: cleanSnippet || '(Sin coincidencia directa extraíble)'
        };
      });

      return {
        success: true,
        message: `Búsqueda semántica FTS5 completada. Se encontraron ${formattedResults.length} documentos relevantes.`,
        results: formattedResults
      };

    } catch (error: any) {
      console.error(`[SmartSearchTool] Error al buscar archivos para la consulta "${query}":`, error.message);
      return {
        success: false,
        error: `Ocurrió un error inesperado al ejecutar la búsqueda SQL FTS5: ${error.message}`
      };
    }
  }

  /**
   * Forzar una actualización de índices en un directorio específico.
   * Útil para cuando el agente crea un archivo nuevo y necesita que sea localizable inmediatamente.
   */
  public async indexTargetDirectory(directoryPath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      console.log(`[SmartSearchTool] Indexando directorio proactivamente: ${directoryPath}`);
      await this.indexer.indexDirectory(directoryPath);
      return { 
        success: true, 
        message: `El directorio ${directoryPath} ha sido indexado y está listo para búsquedas semánticas.` 
      };
    } catch (error: any) {
      console.error('[SmartSearchTool] Error al indexar:', error.message);
      return { 
        success: false, 
        error: `Fallo la indexación del directorio: ${error.message}` 
      };
    }
  }

  /**
   * Obtiene estadísticas de salud y métricas del índice FTS5.
   */
  public getHealthStats() {
    try {
      const stats = this.indexer.getStats();
      return {
        success: true,
        total_files_indexed: stats.totalFiles,
        db_size_bytes: stats.dbSizeBytes,
        last_indexed: stats.lastIndexed
      };
    } catch (error: any) {
      return {
        success: false,
        error: `No se pudieron obtener estadísticas del SemanticIndexer: ${error.message}`
      };
    }
  }
}
