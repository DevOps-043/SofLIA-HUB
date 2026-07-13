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
    name: 'contextual_control',
    description: 'Ajusta el entorno de trabajo de la PC en un solo paso: volumen, brillo, plan de energia y notificaciones. Acepta un preset de contexto (mode) o ajustes individuales. Util para "modo reunion", "modo foco", "modo pelicula", etc.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        mode: { type: 'STRING' as const, description: 'Preset de contexto: "reunion" (vol 40, No Molestar), "foco" (vol 20, ahorro energia, No Molestar), "multimedia" (vol 80), "gaming" (alto rendimiento) o "normal" (restaura valores estandar).' },
        volume: { type: 'NUMBER' as const, description: 'Volumen maestro 0-100 (sobrescribe el preset).' },
        brightness: { type: 'NUMBER' as const, description: 'Brillo de pantalla 0-100 (solo laptops/monitores con soporte WMI).' },
        power_plan: { type: 'STRING' as const, description: 'Plan de energia: "balanced", "high_performance" o "power_saver".' },
        dnd: { type: 'STRING' as const, description: '"on" silencia los banners de notificaciones de Windows, "off" los restaura.' },
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
