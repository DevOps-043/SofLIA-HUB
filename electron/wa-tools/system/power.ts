export const POWER_TOOLS = [
  {
    name: 'lock_session',
    description: 'Bloquea la sesion de Windows (pantalla de bloqueo). REQUIERE confirmacion. El usuario debera ingresar su contrasena para desbloquear.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'shutdown_computer',
    description: 'Apaga la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de apagar. Por defecto 60.' },
      },
    },
  },
  {
    name: 'restart_computer',
    description: 'Reinicia la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de reiniciar. Por defecto 60.' },
      },
    },
  },
  {
    name: 'sleep_computer',
    description: 'Pone la computadora en modo de suspension (sleep). REQUIERE confirmacion.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'cancel_shutdown',
    description: 'Cancela un apagado o reinicio programado previamente con shutdown_computer o restart_computer.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
