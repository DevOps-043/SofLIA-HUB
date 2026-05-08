export const WhatsAppDailyDigestTool = {
  declaration: {
    name: 'generate_weekly_digest',
    description: 'Genera un reporte ejecutivo en PDF completo del estado del sistema, estadisticas operativas y lo envia al usuario por este chat inmediatamente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        include_system_status: {
          type: 'BOOLEAN',
          description: 'Si es true, incluira un mensaje extra en el texto detallando procesos top',
        },
      },
    },
  },
};
