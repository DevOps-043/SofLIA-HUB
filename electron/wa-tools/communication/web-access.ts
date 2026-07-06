export const WEB_ACCESS_TOOLS = [
  {
    name: 'open_file_on_computer',
    description: 'Abre un archivo en la computadora del usuario con su aplicacion predeterminada.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a abrir.' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'open_url',
    description: 'Abre una URL en el navegador predeterminado de la computadora del usuario. SOLO abre la pagina: no interactua con ella. Si el usuario pidio ademas una accion dentro del sitio (reproducir, dar click, llenar formularios), continua con use_computer describiendo la tarea completa y solo reporta exito con estado "completada".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        url: { type: 'STRING' as const, description: 'URL completa a abrir en el navegador.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'web_search',
    description: 'Busca informacion en internet. Usa esto para responder preguntas sobre temas generales, noticias, datos actuales, etc.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        query: { type: 'STRING' as const, description: 'Texto de busqueda.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_webpage',
    description: 'Lee y extrae el texto de una pagina web dada una URL.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        url: { type: 'STRING' as const, description: 'URL completa de la pagina web.' },
      },
      required: ['url'],
    },
  },
];
