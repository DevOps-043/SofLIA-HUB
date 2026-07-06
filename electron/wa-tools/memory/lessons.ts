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
  {
    name: 'run_saved_procedure',
    description: 'Ejecuta un PROCEDIMIENTO guardado del usuario (una receta reutilizable). Úsalo SOLO cuando el usuario CONFIRME que quiere correr uno de los procedimientos listados en "PROCEDIMIENTOS QUE PUEDES EJECUTAR". El procedimiento requiere aprobación antes de realizar cualquier acción (no ejecuta nada sin confirmación).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        request: { type: 'STRING' as const, description: 'La petición o el título del procedimiento a ejecutar (para identificar cuál correr).' },
      },
      required: ['request'],
    },
  },
];
