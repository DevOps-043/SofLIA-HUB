export const KNOWLEDGE_TOOLS = [
  {
    name: 'knowledge_save',
    description: 'Guarda informacion importante en la base de conocimiento persistente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        content: { type: 'STRING' as const, description: 'El dato o conocimiento a guardar.' },
        section: { type: 'STRING' as const, description: 'Seccion donde guardar o seccion nueva.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'knowledge_update_user',
    description: 'Actualiza el perfil del usuario actual con informacion personal, preferencias o contexto laboral.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        section: { type: 'STRING' as const, description: 'Seccion del perfil del usuario.' },
        content: { type: 'STRING' as const, description: 'La informacion a guardar en esa seccion del perfil.' },
      },
      required: ['section', 'content'],
    },
  },
  {
    name: 'knowledge_search',
    description: 'Busca informacion en toda la base de conocimiento.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Texto a buscar en los archivos de conocimiento.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_log',
    description: 'Registra un evento o contexto en el log diario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        content: { type: 'STRING' as const, description: 'El evento o contexto a registrar.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'knowledge_read',
    description: 'Lee el contenido de un archivo de conocimiento especifico.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        file: { type: 'STRING' as const, description: 'Nombre del archivo a leer.' },
      },
      required: ['file'],
    },
  },
];
