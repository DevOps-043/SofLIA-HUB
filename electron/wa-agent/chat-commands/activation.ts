import type { ChatCommandContext } from '../chat-commands';

export async function handleActivationCommand(context: ChatCommandContext, args: string[]): Promise<string> {
  if (!context.isGroup) return 'Este comando solo funciona en grupos.';
  if (!context.waService.isAllowedNumber(context.senderNumber)) {
    return 'Solo el administrador puede cambiar el modo de activacion.';
  }

  const mode = args[0]?.toLowerCase();
  if (mode === 'mention' || mode === 'always') {
    await context.waService.setGroupConfig({ groupActivation: mode });
    const detail = mode === 'mention'
      ? '- Solo respondere cuando me mencionen, usen /soflia, o hagan reply a mi mensaje'
      : '- Respondere a TODOS los mensajes del grupo';
    return `Activacion cambiada a: *${mode}*\n${detail}`;
  }

  return 'Uso: /activation mention | always';
}
