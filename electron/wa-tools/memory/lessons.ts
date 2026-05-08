export const LESSON_MEMORY_TOOLS = [
  {
    name: 'save_lesson',
    description: 'Guarda una leccion aprendida para no repetir el mismo error en el futuro.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        lesson: { type: 'STRING' as const, description: 'La leccion o dato a recordar.' },
        context: { type: 'STRING' as const, description: 'Contexto breve de por que se aprendio esto.' },
      },
      required: ['lesson'],
    },
  },
  {
    name: 'recall_memories',
    description: 'Consulta todas las lecciones aprendidas previamente.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
