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
    description: 'Agente unificado de computer use. Usa browser-native con Playwright para sitios y portales web, windows_uia para apps nativas instrumentables y backend visual de escritorio como fallback para superficies visuales, instaladores y dialogs complejos. Si windows_uia falla por verificacion o poca cobertura, hace handoff automatico a desktop_visual. Devuelve rutas de reporte/trace cuando estan disponibles.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        task: { type: 'STRING' as const, description: 'Descripcion detallada de la tarea. Para tareas web describe el resultado esperado y el sitio o flujo. Para apps nativas describe la ventana, app o dialogo a controlar.' },
        max_steps: { type: 'NUMBER' as const, description: 'Máximo de pasos (defecto 200). Usa 300-500 para tareas muy complejas como juegos o workflows largos.' },
        backend: { type: 'STRING' as const, description: 'Opcional: "auto", "browser", "uia" o "desktop". Por defecto "auto".' },
        start_url: { type: 'STRING' as const, description: 'Opcional: URL inicial para tareas web.' },
        browser_profile: { type: 'STRING' as const, description: 'Perfil persistente opcional para browser_web. Ejemplos: "default", "ventas", "erp".' },
        browser_isolated: { type: 'BOOLEAN' as const, description: 'Si es true, fuerza una sesion web aislada sin reutilizar perfil persistente.' },
        reset_browser_profile: { type: 'BOOLEAN' as const, description: 'Si es true, limpia el perfil web indicado antes de ejecutar la tarea.' },
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
