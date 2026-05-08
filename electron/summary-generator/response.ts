import type { GeneratedSummary, SummaryStats } from './types';

export function parseSummaryResponse(text: string, stats: SummaryStats): GeneratedSummary {
  const parsed = JSON.parse(cleanJsonResponse(text));
  const summaryParts = [
    parsed.resumen || '',
    '',
    parsed.logros?.length ? `*Logros:*\n${parsed.logros.map((item: string) => `  - ${item}`).join('\n')}` : '',
    parsed.dificultades?.length ? `*Dificultades:*\n${parsed.dificultades.map((item: string) => `  - ${item}`).join('\n')}` : '',
    parsed.recomendaciones?.length ? `*Recomendaciones:*\n${parsed.recomendaciones.map((item: string) => `  - ${item}`).join('\n')}` : '',
    '',
    '*Estadisticas:*',
    `  Tiempo activo: ${Math.round(stats.totalActive / 60)} min`,
    `  Tiempo inactivo: ${Math.round(stats.totalIdle / 60)} min`,
    `  Apps: ${stats.topApps.slice(0, 5).map((app) => app.name).join(', ')}`,
  ].filter(Boolean).join('\n');

  return {
    summaryText: summaryParts,
    topApps: stats.topApps,
    productiveTimeSeconds: stats.totalActive,
    idleTimeSeconds: stats.totalIdle,
    totalTimeSeconds: stats.totalActive + stats.totalIdle,
    projectsDetected: parsed.proyectos_detectados || [],
    difficulties: parsed.dificultades || [],
    highlights: parsed.logros || [],
  };
}

export function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

export function buildFallbackSummary(stats: SummaryStats): GeneratedSummary {
  const fallbackSummary = `Sesion de trabajo: ${Math.round(stats.totalActive / 60)} min activo, ${Math.round(stats.totalIdle / 60)} min inactivo.\nApps: ${stats.topApps.slice(0, 5).map((app) => app.name).join(', ')}`;
  return {
    summaryText: fallbackSummary,
    topApps: stats.topApps,
    productiveTimeSeconds: stats.totalActive,
    idleTimeSeconds: stats.totalIdle,
    totalTimeSeconds: stats.totalActive + stats.totalIdle,
    projectsDetected: [],
    difficulties: [],
    highlights: [],
  };
}
