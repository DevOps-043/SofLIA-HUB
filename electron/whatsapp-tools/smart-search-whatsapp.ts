import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';

/**
 * Esquema Zod para la validación de los argumentos de entrada de la herramienta.
 * Se evita el error TS2345 infiriendo correctamente los tipos nativos.
 */
export const SmartFileSearchInputSchema = z.object({
  directory: z.string().optional().describe('Directorio base para la búsqueda (opcional). Si se omite, se buscará en lugares comunes del usuario.'),
  keyword: z.string().describe('Palabra clave o frase a buscar dentro del contenido de los archivos.'),
  extensions: z.array(z.string()).optional().describe('Extensiones de archivo a incluir, ej: ["txt", "md", "csv"].'),
});

export type SmartFileSearchInput = z.infer<typeof SmartFileSearchInputSchema>;

/**
 * Declaración de la herramienta para ser inyectada en el prompt del agente (Gemini).
 * Utiliza el SchemaType compatible con la API de generatvie-ai.
 */
export const smartFileSearchToolDeclaration = {
  name: 'smart_file_search',
  description: 'Busca una palabra clave DENTRO del contenido de los archivos de texto y documentos. Devuelve la ruta, el nombre y un extracto de 200 caracteres donde coincida la frase. Ideal para responder "busca el documento que habla sobre X".',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      directory: { type: 'STRING' as const, description: 'Directorio donde buscar. Si se omite, busca en Documentos y Escritorio.' },
      keyword: { type: 'STRING' as const, description: 'Palabra o frase exacta a buscar en el contenido.' },
      extensions: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Extensiones a revisar (ej: ["txt", "md", "csv", "json"]). Sin punto.' },
    },
    required: ['keyword'],
  },
};

const DEFAULT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.log', '.xml', '.html', '.js', '.ts'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Límite de 5MB por archivo para no saturar la memoria RAM
const MAX_RESULTS = 15; // Límite máximo de resultados para no romper el contexto del LLM
const MAX_DIRECTORIES_TO_SCAN = 10000; // Cortocircuito de seguridad en carpetas masivas

export interface FileSearchResult {
  path: string;
  name: string;
  snippet: string;
}

/**
 * Handler principal que ejecuta la búsqueda recursiva.
 * Integración nativa sin dependencias externas pesadas.
 */
export async function smartFileSearchHandler(args: any): Promise<{
  success: boolean;
  results?: FileSearchResult[];
  message?: string;
  error?: string;
}> {
  try {
    // Validar parámetros con Zod para asegurar tipado
    const parsedArgs = SmartFileSearchInputSchema.parse(args);
    const keyword = parsedArgs.keyword;

    if (!keyword || keyword.trim() === '') {
      return { success: false, error: 'Debe proporcionar una palabra clave válida.' };
    }

    // Normalizar extensiones
    const exts = parsedArgs.extensions && parsedArgs.extensions.length > 0 
      ? parsedArgs.extensions.map(e => e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`)
      : DEFAULT_EXTENSIONS;

    // Resolver directorios a buscar
    const directoriesToSearch: string[] = [];
    if (parsedArgs.directory) {
      directoriesToSearch.push(parsedArgs.directory);
    } else {
      const home = os.homedir();
      directoriesToSearch.push(path.join(home, 'Documents'));
      directoriesToSearch.push(path.join(home, 'Desktop'));
      
      // Intentar agregar OneDrive si el usuario lo tiene configurado (muy común en Windows)
      try {
        const oneDriveDocs = path.join(home, 'OneDrive', 'Documentos');
        await fs.access(oneDriveDocs);
        directoriesToSearch.push(oneDriveDocs);
      } catch { /* Ignorar si no existe */ }
      
      try {
        const oneDriveDesktop = path.join(home, 'OneDrive', 'Escritorio');
        await fs.access(oneDriveDesktop);
        directoriesToSearch.push(oneDriveDesktop);
      } catch { /* Ignorar si no existe */ }
    }

    const results: FileSearchResult[] = [];
    const state = { count: 0, scannedFiles: 0 };
    
    // Iniciar búsqueda recursiva
    for (const dir of directoriesToSearch) {
      try {
        await fs.access(dir);
        await searchInDirectory(dir, keyword, exts, results, MAX_RESULTS, state);
      } catch (err: any) {
        console.warn(`[smartFileSearch] Directorio no accesible: ${dir} - ${err.message}`);
      }
      if (results.length >= MAX_RESULTS) break;
    }

    return { 
      success: true, 
      results, 
      message: results.length > 0 
        ? `Se encontraron ${results.length} resultados para "${keyword}" tras revisar ${state.scannedFiles} archivos.` 
        : `No se encontró "${keyword}" en los ${state.scannedFiles} archivos revisados.`
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Función recursiva que inspecciona archivos uno a uno para buscar la coincidencia.
 */
async function searchInDirectory(
  dir: string, 
  keyword: string, 
  exts: string[], 
  results: FileSearchResult[], 
  maxResults: number,
  state: { count: number, scannedFiles: number }
): Promise<void> {
  // Cortocircuitos de seguridad
  if (results.length >= maxResults) return;
  if (state.count > MAX_DIRECTORIES_TO_SCAN) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // Permisos denegados u otros errores del sistema operativo
  }

  const keywordLower = keyword.toLowerCase();
  // Ignorar carpetas pesadas del sistema o código fuente que no aportan al usuario
  const skipDirs = new Set(['node_modules', '.git', 'AppData', 'Local Settings', 'Application Data', 'dist', 'build', '.next', '.vscode']);

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (state.count > MAX_DIRECTORIES_TO_SCAN) return;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignorar directorios ocultos y carpetas de sistema
      if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
        state.count++;
        await searchInDirectory(fullPath, keyword, exts, results, maxResults, state);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      
      if (exts.includes(ext)) {
        state.scannedFiles++;
        try {
          const stats = await fs.stat(fullPath);
          
          if (stats.size > 0 && stats.size <= MAX_FILE_SIZE) {
            // Leer y buscar (Integración futura con FTS5 SQLite aquí si está activa)
            const content = await fs.readFile(fullPath, 'utf-8');
            const contentLower = content.toLowerCase();
            const index = contentLower.indexOf(keywordLower);
            
            if (index !== -1) {
              // Extraer un snippet de texto de ~200 caracteres (100 antes, 100 después)
              const start = Math.max(0, index - 100);
              const end = Math.min(content.length, index + keyword.length + 100);
              
              let snippet = content.substring(start, end)
                .replace(/\r?\n|\r/g, ' ') // Quitar saltos de línea
                .replace(/\s+/g, ' ')      // Colapsar espacios extra
                .trim();
              
              if (start > 0) snippet = '...' + snippet;
              if (end < content.length) snippet = snippet + '...';

              results.push({
                path: fullPath,
                name: entry.name,
                snippet
              });
            }
          }
        } catch {
          // Fallo de lectura (archivo en uso, bloqueado, etc.) -> continuar
        }
      }
    }
  }
}
