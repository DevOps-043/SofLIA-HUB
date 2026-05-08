export const CLIPBOARD_MEMORY_TOOLS = [
  {
    name: 'search_clipboard_history',
    description: 'Busca inteligentemente en el historial reciente de textos copiados al portapapeles.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Descripcion en lenguaje natural de lo que se busca.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'semantic_file_search',
    description: 'Busca archivos olvidados por contenido o descripcion natural usando busqueda semantica FTS5.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Frase, palabras clave o tema a buscar dentro del contenido de los documentos.' },
        max_results: { type: 'NUMBER' as const, description: 'Maximo de resultados. Por defecto 3.' },
      },
      required: ['query'],
    },
  },
];
