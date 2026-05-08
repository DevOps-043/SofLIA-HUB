export const APP_LAUNCHER_DEFINITION = {
  name: 'manage_applications_tool',
  description: 'Herramienta para gestionar aplicaciones. Permite abrir, cerrar y listar las aplicaciones en ejecucion de forma remota en la computadora.',
  parameters: {
    type: 'OBJECT' as const,
    properties: {
      action: {
        type: 'STRING',
        description: 'Accion a realizar: "list" (listar apps), "launch" (abrir app) o "close" (cerrar app).',
      },
      appName: {
        type: 'STRING',
        description: 'Nombre de la aplicacion a abrir o cerrar. Ignorado si la accion es "list".',
      },
    },
    required: ['action'],
  },
};
