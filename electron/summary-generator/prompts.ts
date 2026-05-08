import type { SessionInfo, SummaryStats } from './types';

export function buildDailySummaryPrompt(
  sessionInfo: SessionInfo,
  stats: SummaryStats,
  irisProjects?: string[],
): string {
  const projectsContext = irisProjects?.length
    ? `\nPROYECTOS CONOCIDOS DEL USUARIO: ${irisProjects.join(', ')}`
    : '';

  return `Eres un analista de productividad. Genera un resumen detallado de la sesion de trabajo del usuario.

SESION:
- Inicio: ${sessionInfo.startedAt}
- Fin: ${sessionInfo.endedAt || 'En curso'}
- Tipo: ${sessionInfo.triggerType === 'calendar_auto' ? 'Auto (calendario)' : 'Manual'}
${sessionInfo.calendarEventTitle ? `- Evento: ${sessionInfo.calendarEventTitle}` : ''}

ESTADISTICAS:
- Tiempo total: ${Math.round((stats.totalActive + stats.totalIdle) / 60)} minutos
- Tiempo activo: ${Math.round(stats.totalActive / 60)} minutos
- Tiempo inactivo: ${Math.round(stats.totalIdle / 60)} minutos
- Apps mas usadas: ${stats.topApps.slice(0, 5).map((app) => `${app.name} (${Math.round(app.duration / 60)}min)`).join(', ')}
${projectsContext}

TIMELINE DE ACTIVIDAD:
${stats.timelineText}

Genera un JSON con este formato exacto:
{
  "resumen": "Resumen de 3-5 oraciones describiendo que hizo el usuario, en que se enfoco, y como fue su productividad.",
  "proyectos_detectados": ["nombres de proyectos en los que trabajo"],
  "dificultades": ["problemas o bloqueos que parece haber tenido"],
  "logros": ["tareas completadas o avances significativos"],
  "recomendaciones": ["sugerencias para mejorar productividad"]
}

IMPORTANTE: Responde SOLO el JSON, sin texto adicional ni bloques de codigo.`;
}

export function buildCategorizationPrompt(apps: string[]): string {
  return `Clasifica cada aplicacion como "productive", "unproductive", o "neutral".
Aplicaciones: ${apps.join(', ')}

Responde SOLO un JSON: {"app_name": "category", ...}`;
}
