import type { GChatService } from '../gchat-service.ts';

export function getConnectedGoogleEmail(this: GChatService): string | null {
    const googleConnection = this.calendarService
      .getConnections()
      .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);

    return googleConnection?.email?.trim().toLowerCase() || null;
  }
