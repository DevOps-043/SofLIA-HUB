import type { StudioSnapshot } from '../../../shared/live-studio.contract';

export function roomDistribution(total: number, mode: 'size' | 'count', value: number) {
  if (!Number.isInteger(total) || total < 1 || total > 500 || !Number.isInteger(value) || value < 1 || value > 50) return [];
  const count = Math.min(total, mode === 'size' ? Math.ceil(total / value) : value, 50);
  return Array.from({ length: count }, (_, index) => Math.floor(total / count) + (index < total % count ? 1 : 0));
}

export function availableRoomMembers(snapshot: StudioSnapshot) {
  const time = Date.parse(snapshot.server_time);
  return snapshot.state.members.filter(member => !member.instructor && snapshot.state.moderation.restrictions[member.user_id] !== 'blocked' && time - Date.parse(member.seen_at) < 90000);
}

export function roomConnectionLabel(connected: boolean, status?: 'ready' | 'waiting' | 'unavailable', missing = 0, reason?: 'assignment_revocation') {
  if (!connected) return 'Conecta la sesión para usar el audio y video de las salas.';
  if (reason === 'assignment_revocation') return 'La asignación académica se retiró. Cierra y vuelve a abrir las salas para retirar también la asignación de audio y video.';
  if (status === 'ready') return 'Audio y video de las salas preparados';
  if (status === 'unavailable') return 'Gestiona las salas de audio y video desde los controles de la llamada.';
  if (missing) return `Esperando la conexión audiovisual de ${missing} participantes`;
  return 'Esperando confirmación del audio y video de las salas';
}
