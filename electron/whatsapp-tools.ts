/**
 * Barrel re-export del paquete `./wa-tools`.
 *
 * Preserva los imports históricos (`from './whatsapp-tools'`). Las declaraciones
 * de tools viven separadas por dominio en `./wa-tools/`. Cualquier código nuevo
 * debería importar directamente de `./wa-tools`.
 *
 * Para agregar tools nuevas, ver instrucciones en `./wa-tools/index.ts`.
 */

export {
  BLOCKED_TOOLS_WA,
  CONFIRM_TOOLS_WA,
  GROUP_BLOCKED_TOOLS,
  WA_TOOL_DECLARATIONS,
} from './wa-tools';
