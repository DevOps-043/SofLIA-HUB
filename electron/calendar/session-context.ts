import type { CalendarConnection, CalendarServiceCore } from './types';

/** La revisión distingue incluso un cierre de sesión seguido del mismo usuario. */
export function calendarSession(service: CalendarServiceCore, connection?: CalendarConnection): () => void {
  const owner = service.userId;
  const revision = service.contextRevision;
  return () => {
    if (!owner || service.userId !== owner || service.contextRevision !== revision
      || (connection && (connection.userId !== owner || !connection.isActive || service.connections.get(connection.provider) !== connection))) {
      throw new Error('La sesión del calendario cambió.');
    }
  };
}
