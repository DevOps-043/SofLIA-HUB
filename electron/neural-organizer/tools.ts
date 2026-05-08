export const NEURAL_ORGANIZER_TOOLS = {
  functionDeclarations: [
    {
      name: 'neural_organizer_status',
      description: 'Obtiene el estado del Organizador Neuronal.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'neural_organizer_toggle',
      description: 'Activa o desactiva el Organizador Neuronal de archivos.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enable: { type: 'BOOLEAN' as const, description: 'true para activar, false para desactivar.' },
        },
        required: ['enable'],
      },
    },
  ],
};
