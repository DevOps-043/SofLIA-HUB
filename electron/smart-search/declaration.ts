export const semanticFileSearchDeclaration = {
  name: 'semantic_file_search',
  description: 'Busca archivos olvidados en la computadora por su contenido o descripcion natural usando busqueda semantica FTS5.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      query: {
        type: 'STRING' as const,
        description: 'Frase, palabras clave o tema a buscar dentro del contenido de los documentos.',
      },
      max_results: {
        type: 'NUMBER' as const,
        description: 'Numero maximo de resultados a devolver. Por defecto es 3.',
      },
    },
    required: ['query'],
  },
};
