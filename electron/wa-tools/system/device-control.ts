export const DEVICE_CONTROL_TOOLS = [
  {
    name: 'set_volume',
    description: 'Ajusta el volumen del sistema. Puede subir, bajar o silenciar/desilenciar.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        level: { type: 'NUMBER' as const, description: 'Nivel de volumen de 0 a 100. Si se omite, usa la accion.' },
        action: { type: 'STRING' as const, description: '"mute" para silenciar, "unmute" para desilenciar, "up" para subir 10%, "down" para bajar 10%.' },
      },
    },
  },
  {
    name: 'toggle_wifi',
    description: 'Activa o desactiva la conexion Wi-Fi. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        enable: { type: 'BOOLEAN' as const, description: 'true para activar Wi-Fi, false para desactivar.' },
      },
      required: ['enable'],
    },
  },
];
