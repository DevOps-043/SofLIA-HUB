/**
 * Tools de Computer Use: agente unificado de automatización + perfiles de browser.
 *
 * `use_computer` es el orquestador inteligente que decide entre browser-native
 * (Playwright), windows_uia (apps nativas instrumentables) y desktop visual
 * (fallback) según la naturaleza de la tarea.
 */

export const COMPUTER_TOOLS = [
  {
    name: 'use_computer',
    description: 'Agente unificado de computer use. Usa browser-native con Playwright para sitios y portales web, windows_uia para apps nativas instrumentables y backend visual de escritorio como fallback para superficies visuales, instaladores y dialogs complejos. Si windows_uia falla por verificacion o poca cobertura, hace handoff automatico a desktop_visual. IMPORTANTE: el navegador de Playwright usa un perfil propio SIN las sesiones ni contraseñas del usuario; si la tarea necesita cuentas donde el usuario ya esta logueado o sus contraseñas guardadas, pasa use_real_browser:true para trabajar sobre su navegador predeterminado real. Devuelve rutas de reporte/trace cuando estan disponibles. El resultado incluye "estado": SOLO afirma al usuario que la tarea se completo si estado es "completada"; con "presupuesto_agotado", "fallida", "cancelada" o "cola_expirada" reporta el progreso real y pregunta si continuar. NUNCA anuncies exito antes de recibir este resultado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task: { type: 'STRING' as const, description: 'Descripcion detallada de la tarea. Para tareas web describe el resultado esperado y el sitio o flujo. Para apps nativas describe la ventana, app o dialogo a controlar.' },
        max_steps: { type: 'NUMBER' as const, description: 'Máximo de pasos. Si se omite, el agente presupuesta segun la complejidad del plan (recomendado). Solo indica un valor para tareas excepcionalmente largas.' },
        backend: { type: 'STRING' as const, description: 'Opcional: "auto", "browser", "uia" o "desktop". Por defecto "auto".' },
        start_url: { type: 'STRING' as const, description: 'Opcional: URL inicial para tareas web.' },
        browser_profile: { type: 'STRING' as const, description: 'Perfil persistente opcional para browser_web. Ejemplos: "default", "ventas", "erp".' },
        browser_isolated: { type: 'BOOLEAN' as const, description: 'Si es true, fuerza una sesion web aislada sin reutilizar perfil persistente.' },
        reset_browser_profile: { type: 'BOOLEAN' as const, description: 'Si es true, limpia el perfil web indicado antes de ejecutar la tarea.' },
        use_real_browser: { type: 'BOOLEAN' as const, description: 'Si es true, la tarea se ejecuta sobre el navegador PREDETERMINADO real del usuario (con sus sesiones iniciadas y contraseñas guardadas) usando el backend visual. Usalo cuando la tarea dependa de cuentas donde el usuario ya esta logueado.' },
      },
      required: ['task'],
    },
  },
  {
    name: 'list_browser_profiles',
    description: 'Lista los perfiles persistentes disponibles para browser_web.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'reset_browser_profile',
    description: 'Borra un perfil persistente de browser_web. REQUIERE confirmaciÃ³n.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        profile_id: { type: 'STRING' as const, description: 'ID del perfil a limpiar.' },
      },
      required: ['profile_id'],
    },
  },
];
