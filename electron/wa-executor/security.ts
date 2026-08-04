/**
 * Capa de seguridad del dispatcher de tools de WhatsApp.
 *
 * Tres niveles de protección:
 *  1. **Tools globalmente bloqueadas** (`BLOCKED_TOOLS_WA`): nunca se ejecutan
 *     desde WhatsApp. Hoy está vacío.
 *  2. **Tools bloqueadas en grupos** (`GROUP_BLOCKED_TOOLS`): bloqueadas si el
 *     mensaje viene de un chat grupal, para evitar que miembros del grupo
 *     controlen la máquina del host.
 *  3. **Self-protected paths**: bloquea cualquier argumento que mencione el
 *     código fuente de SofLIA, secrets, o rutas de Electron. Previene el
 *     ataque "AI lee su propio prompt/keys vía read_file/execute_command".
 *
 * Las tools en `SELF_PROTECTED_EXEMPT_TOOLS` están exentas de la inspección
 * #3 porque legítimamente operan sobre paths que coinciden con los patrones
 * (p.ej. app_chat_get_context puede mencionar "soflia" en una conversación).
 */

const SOFLIA_BLOCKED_PATHS = [
  /soflia[\s_-]*hub/i,
  /dist[\\/\-]electron/i,
  /app\.asar/i,
  /SOFLIA[\s_]*Source/i,
  /whatsapp[\s_-]*agent/i,
  /desktop[\s_-]*agent/i,
  /main[\s_-]*.*\.js/i,
  /electron[\\/].*\.(ts|js)/i,
  /src[\\/].*\.(tsx?|jsx?)/i,
  /\.env\b/i,
  /supabase/i,
  /api[\s_-]*key/i,
];

export const SELF_PROTECTED_EXEMPT_TOOLS = new Set([
  'app_chat_list_conversations',
  'app_chat_get_context',
  'app_chat_append_note',
  'app_chat_list_assets',
  'app_chat_send_asset',
]);

/**
 * Determina si los argumentos de un tool intentan acceder a recursos
 * protegidos del propio SofLIA. Devuelve un mensaje de error legible si
 * hay match, o `null` si está limpio.
 */
export function detectProtectedPathAccess(
  toolName: string,
  toolArgs: Record<string, unknown>,
): string | null {
  if (SELF_PROTECTED_EXEMPT_TOOLS.has(toolName)) {
    return null;
  }

  const allArgValues = Object.values(toolArgs)
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  if (!allArgValues) return null;

  const isBlocked = SOFLIA_BLOCKED_PATHS.some((pattern) => pattern.test(allArgValues));
  if (!isBlocked) return null;

  console.warn(
    `[WhatsApp Agent] ⛔ SECURITY: Blocked tool "${toolName}" targeting SofLIA code: "${allArgValues.slice(0, 150)}"`,
  );
  return 'Acceso denegado: no puedo acceder a archivos del sistema de SofLIA por seguridad.';
}
