import type { BackgroundStatus } from './background-teams';
export const teamStatusLabels: Record<BackgroundStatus, string> = { queued: 'En cola', running: 'En marcha', verifying: 'Revisando entregables', paused: 'Pausado', completed: 'Trabajo terminado', failed: 'Necesita atención', cancelled: 'Cancelado', interrupted: 'Pendiente de reanudar' };
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export function backgroundJobId(message: { text: string; backgroundJobId?: string }): string | undefined {
  if (message.backgroundJobId && new RegExp('^' + uuid + '$', 'i').test(message.backgroundJobId)) return message.backgroundJobId;
  if (!message.text.startsWith('Equipo ejecutor iniciado.') || message.text.includes('```')) return undefined;
  return new RegExp('^Trabajo:\\s*(' + uuid + ')\\s*$', 'im').exec(message.text)?.[1];
}
export function cleanTeamText(text: string): string {
  return text.replace(/\[([^\]]+)\]\((?:artifact|artifac):\/\/[^)]+\)/gi, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, target: string) => {
      try { const url = new URL(target); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return match; } catch { /* Enlaces locales y no válidos quedan como texto. */ }
      return label;
    })
    .replace(/(?:artifact|artifac):\/\/[^\s)\]<>]+/gi, 'archivo del equipo')
    .replace(new RegExp('^Trabajo:\\s*' + uuid + '\\s*$', 'gim'), '')
    .replace(/\n{3,}/g, '\n\n').trim();
}
/** Explica la limitación sin exponer roles, herramientas ni mensajes internos. */
export function backgroundFailureMessage(error: string | null): string {
  if (/presupuesto|límite|tiempo/i.test(error ?? '')) return 'Se alcanzó el límite de este trabajo. Conserva los archivos y continúa con un nuevo encargo.';
  if (/investigación|referencias|fuentes/i.test(error ?? '')) return 'Faltó completar la comprobación de fuentes. Los archivos disponibles se conservaron.';
  if (/archivo|entregable|documento|presentación|hoja/i.test(error ?? '')) return 'Faltó completar y comprobar un archivo. Puedes reanudar el trabajo.';
  return 'Quedó trabajo pendiente. Puedes reanudarlo y conservar los archivos disponibles.';
}
