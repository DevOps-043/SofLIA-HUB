/**
 * Declaraciones de tools del agente WhatsApp — sistema de archivos y portapapeles.
 *
 * Categoría: operaciones contra el filesystem local (lectura, escritura, mover,
 * batch ops) más portapapeles. Lectura es libre; escritura/borrado pasan por
 * `CONFIRM_TOOLS_WA` (ver `security.ts`).
 */

export const FILESYSTEM_TOOLS = [
  {
    name: 'list_directory',
    description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
        show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Lee y devuelve el contenido de un archivo de texto. Máximo 1MB.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Crea o sobrescribe un archivo con contenido de texto.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
        content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Crea una carpeta nueva.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
      required: ['path'],
    },
  },
  {
    name: 'move_item',
    description: 'Mueve o renombra un archivo o carpeta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
        destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
      },
      required: ['source_path', 'destination_path'],
    },
  },
  {
    name: 'copy_item',
    description: 'Copia un archivo o carpeta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
        destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
      },
      required: ['source_path', 'destination_path'],
    },
  },
  {
    name: 'delete_item',
    description: 'Envía un archivo o carpeta a la papelera. REQUIERE confirmación del usuario via WhatsApp.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
      required: ['path'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Obtiene información de un archivo: tamaño, fechas, tipo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Busca archivos por nombre en un directorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
        pattern: { type: 'STRING' as const, description: 'Patrón de texto a buscar.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'organize_files',
    description: 'Organiza TODOS los archivos de un directorio en subcarpetas automáticamente según su extensión o tipo. Modos: "extension" (cada extensión en su carpeta: PDF, XLSX, etc.), "type" (categorías: Documentos, Imagenes, Videos, Audio, etc.), "date" (por mes: 2026-01, 2026-02), "custom" (con reglas personalizadas). Usa dry_run=true para previsualizar sin mover. Puede trabajar de forma recursiva y devuelve operationId para deshacer después si hace falta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del directorio a organizar (ej: C:\\Users\\fysg5\\Downloads).' },
        mode: { type: 'STRING' as const, description: 'Modo: "extension" (por extensión), "type" (por categoría inteligente), "date" (por mes), "custom" (reglas personalizadas). Default: "extension".' },
        rules: { type: 'OBJECT' as const, description: 'Solo para modo "custom". Mapa extensión→carpeta. Ej: {"pdf": "Reportes", "xlsx": "Excel", "*": "Otros"}.' },
        dry_run: { type: 'BOOLEAN' as const, description: 'Si es true, solo muestra qué haría sin mover nada. Útil para previsualizar.' },
        recursive: { type: 'BOOLEAN' as const, description: 'Si es true, incluye subcarpetas. Úsalo cuando el usuario diga "todo", "todas las subcarpetas" o quiera ordenar un árbol completo.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'batch_move_files',
    description: 'Mueve TODOS los archivos que coincidan con cierta extensión o patrón de un directorio a otro. Ideal para: "mueve todos los PDF de Descargas a Documentos", "pasa las fotos a la carpeta Imagenes". Puede trabajar de forma recursiva y devuelve operationId para deshacer después si hace falta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_directory: { type: 'STRING' as const, description: 'Directorio origen.' },
        destination_directory: { type: 'STRING' as const, description: 'Directorio destino (se crea si no existe).' },
        extensions: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Lista de extensiones a filtrar (ej: ["pdf", "docx"]). Sin punto.' },
        pattern: { type: 'STRING' as const, description: 'Patrón de nombre a filtrar (ej: "reporte", "factura"). Busca coincidencia parcial.' },
        recursive: { type: 'BOOLEAN' as const, description: 'Si es true, incluye subcarpetas del directorio origen.' },
      },
      required: ['source_directory', 'destination_directory'],
    },
  },
  {
    name: 'list_directory_summary',
    description: 'Resume el contenido de un directorio: cuántos archivos hay por extensión, tamaño total, ejemplos de cada tipo. Ideal para directorios con muchos archivos (100+) donde list_directory sería demasiado largo. Usa esto PRIMERO para entender qué hay antes de organizar.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del directorio.' },
        recursive: { type: 'BOOLEAN' as const, description: 'Si es true, incluye subcarpetas en el resumen.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'undo_last_file_operation',
    description: 'Revierte una organización o movimiento masivo de archivos previamente ejecutado. Úsalo si el usuario pide deshacer la última organización o revertir una operación concreta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        operation_id: { type: 'STRING' as const, description: 'Opcional. ID específico de operación a revertir. Si se omite, revierte la última operación registrada.' },
      },
    },
  },
  {
    name: 'clipboard_read',
    description: 'Lee el portapapeles.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'clipboard_write',
    description: 'Escribe texto en el portapapeles.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { text: { type: 'STRING' as const, description: 'Texto a copiar.' } },
      required: ['text'],
    },
  },
  {
    name: 'smart_find_file',
    description: 'Busca un archivo por nombre en TODA la computadora del usuario (escritorio, documentos, descargas, OneDrive, subcarpetas). Usa esto SIEMPRE que el usuario mencione un archivo por nombre. No necesitas saber la ruta — esta herramienta busca automáticamente en todas las ubicaciones comunes.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        filename: { type: 'STRING' as const, description: 'Nombre del archivo a buscar (parcial o completo). Ej: "servicios", "tarea.pdf", "notas"' },
      },
      required: ['filename'],
    },
  },
];
