export const CLIPBOARD_AND_SEARCH_TOOLS = [
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
    description: 'Busca un archivo por nombre en toda la computadora del usuario usando ubicaciones comunes.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        filename: { type: 'STRING' as const, description: 'Nombre parcial o completo del archivo a buscar.' },
      },
      required: ['filename'],
    },
  },
];
