import type { GChatService } from '../gchat-service.ts';

export function resolveSenderDisplayName(this: GChatService, sender: any): string {
    if (typeof sender?.displayName === 'string' && sender.displayName.trim()) {
      return sender.displayName.trim();
    }
    if (typeof sender?.email === 'string' && sender.email.trim()) {
      return sender.email.trim();
    }
    if (typeof sender?.name === 'string' && sender.name.trim()) {
      return sender.name.trim();
    }
    if (typeof sender?.type === 'string' && sender.type.trim()) {
      return sender.type === 'HUMAN' ? 'Usuario de Google Chat' : sender.type.trim();
    }
    return 'Remitente desconocido';
  }
