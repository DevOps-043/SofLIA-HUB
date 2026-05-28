import {
  WHATSAPP_ACCESS_PERMISSION_LABELS,
  WHATSAPP_ACCESS_PERMISSIONS,
  formatWhatsAppPermissionList,
  getWhatsAppPermissionsForSender,
  isWhatsAppMasterNumber,
  normalizeWhatsAppAccessPermissions,
} from '../../whatsapp/access-control';
import { normalizePhoneNumber } from '../../whatsapp/phone-utils';
import type { WhatsAppAccessPermission } from '../../whatsapp/types';
import type { ChatCommandContext } from '../chat-commands';

const PERMISSION_ALIASES: Record<string, WhatsAppAccessPermission | 'all'> = {
  todo: 'all',
  todos: 'all',
  all: 'all',
  archivos: 'files_read',
  leer_archivos: 'files_read',
  ver_archivos: 'files_read',
  files: 'files_read',
  modificar_archivos: 'files_write',
  escribir_archivos: 'files_write',
  pantalla: 'screen_view',
  screenshot: 'screen_view',
  pc: 'computer_control',
  computadora: 'computer_control',
  control_pc: 'computer_control',
  terminal: 'shell',
  comandos: 'shell',
  shell: 'shell',
  portapapeles: 'clipboard',
  clipboard: 'clipboard',
  google: 'google_workspace',
  workspace: 'google_workspace',
  mensajes: 'messaging',
  whatsapp: 'messaging',
  sistema: 'system_control',
  procesos: 'system_control',
  automatizaciones: 'automation',
  integraciones: 'automation',
  nodos: 'remote_nodes',
  remoto: 'remote_nodes',
};

export async function handlePermissionsCommand(
  context: ChatCommandContext,
  args: string[],
): Promise<string> {
  const config = context.waService.config;
  if (!config.masterNumber) {
    return 'No hay numero maestro configurado. Configuralo primero desde SofLIA Hub > WhatsApp > Acceso Maestro.';
  }
  if (!isWhatsAppMasterNumber(config, context.senderNumber)) {
    return 'Solo el numero maestro puede administrar permisos de WhatsApp.';
  }

  const action = (args[0] || 'lista').toLowerCase();
  if (['lista', 'listar', 'ver', 'status'].includes(action)) return formatPermissionsStatus(context);

  const number = normalizePhoneNumber(args[1]);
  if (!number) return 'Uso: /permisos dar 521... pantalla archivos | /permisos quitar 521... pantalla | /permisos limpiar 521...';
  if (isWhatsAppMasterNumber(config, number)) {
    return 'Ese numero ya es el maestro y tiene todos los permisos.';
  }

  if (['limpiar', 'clear', 'reset'].includes(action)) {
    await context.waService.setAccessConfig({ contactPermissions: { [number]: null } });
    return `Permisos eliminados para +${number}.`;
  }

  const parsed = parsePermissionArgs(args.slice(2));
  if (parsed.permissions.length === 0) {
    return `No reconoci esos permisos. Opciones: ${Object.values(WHATSAPP_ACCESS_PERMISSION_LABELS).join(', ')}.`;
  }

  const current = new Set(getWhatsAppPermissionsForSender(config, number));
  if (['dar', 'permitir', 'conceder', 'grant', 'add'].includes(action)) {
    parsed.permissions.forEach((permission) => current.add(permission));
  } else if (['quitar', 'revocar', 'remove'].includes(action)) {
    parsed.permissions.forEach((permission) => current.delete(permission));
  } else {
    return 'Accion no reconocida. Usa: lista, dar, quitar o limpiar.';
  }

  const nextPermissions = normalizeWhatsAppAccessPermissions(Array.from(current));
  await context.waService.setAccessConfig({
    contactPermissions: { [number]: nextPermissions.length > 0 ? nextPermissions : null },
  });
  return `Permisos de +${number}: ${formatWhatsAppPermissionList(nextPermissions)}.`;
}

function formatPermissionsStatus(context: ChatCommandContext): string {
  const config = context.waService.config;
  const lines = [
    '*Permisos WhatsApp*',
    `Maestro: +${config.masterNumber}`,
  ];
  const entries = Object.entries(config.contactPermissions || {});
  if (entries.length === 0) {
    lines.push('Contactos: sin permisos especiales.');
  } else {
    for (const [number, permissions] of entries) {
      lines.push(`+${number}: ${formatWhatsAppPermissionList(permissions)}`);
    }
  }
  return lines.join('\n');
}

function parsePermissionArgs(rawArgs: string[]): { permissions: WhatsAppAccessPermission[] } {
  const tokens = rawArgs
    .join(' ')
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase().replace(/-/g, '_'))
    .filter(Boolean);

  if (tokens.some((token) => PERMISSION_ALIASES[token] === 'all')) {
    return { permissions: [...WHATSAPP_ACCESS_PERMISSIONS] };
  }

  return {
    permissions: normalizeWhatsAppAccessPermissions(
      tokens.map((token) => PERMISSION_ALIASES[token] || token),
    ),
  };
}
