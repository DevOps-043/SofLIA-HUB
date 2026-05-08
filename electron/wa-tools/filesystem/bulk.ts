export const BULK_FILE_TOOLS = [
  {
    name: 'search_files',
    description: 'Busca archivos por nombre en un directorio.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
        pattern: { type: 'STRING' as const, description: 'Patron de texto a buscar.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'organize_files',
    description: 'Organiza archivos de un directorio en subcarpetas automaticamente segun extension, tipo, fecha o reglas personalizadas. Usa dry_run=true para previsualizar.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del directorio a organizar.' },
        mode: { type: 'STRING' as const, description: 'Modo: "extension", "type", "date" o "custom". Default: "extension".' },
        rules: { type: 'OBJECT' as const, description: 'Solo para modo "custom". Mapa extension a carpeta.' },
        dry_run: { type: 'BOOLEAN' as const, description: 'Si es true, solo muestra que haria sin mover nada.' },
        recursive: { type: 'BOOLEAN' as const, description: 'Si es true, incluye subcarpetas.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'batch_move_files',
    description: 'Mueve todos los archivos que coincidan con cierta extension o patron de un directorio a otro. Puede trabajar de forma recursiva.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_directory: { type: 'STRING' as const, description: 'Directorio origen.' },
        destination_directory: { type: 'STRING' as const, description: 'Directorio destino. Se crea si no existe.' },
        extensions: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Lista de extensiones a filtrar sin punto.' },
        pattern: { type: 'STRING' as const, description: 'Patron de nombre a filtrar. Busca coincidencia parcial.' },
        recursive: { type: 'BOOLEAN' as const, description: 'Si es true, incluye subcarpetas del directorio origen.' },
      },
      required: ['source_directory', 'destination_directory'],
    },
  },
  {
    name: 'list_directory_summary',
    description: 'Resume el contenido de un directorio: archivos por extension, tamano total y ejemplos de cada tipo.',
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
    description: 'Revierte una organizacion o movimiento masivo de archivos previamente ejecutado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        operation_id: { type: 'STRING' as const, description: 'ID especifico de operacion a revertir. Si se omite, revierte la ultima registrada.' },
      },
    },
  },
];
