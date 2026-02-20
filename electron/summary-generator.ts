/**
 * SummaryGenerator — Uses Gemini AI to generate end-of-day productivity summaries.
 * Analyzes activity logs and produces structured reports.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Types ──────────────────────────────────────────────────────────

interface ActivityLogEntry {
  timestamp: string;
  windowTitle: string;
  processName: string;
  url?: string;
  idle: boolean;
  idleSeconds: number;
  ocrText?: string;
  durationSeconds: number;
}

interface SessionInfo {
  startedAt: string;
  endedAt?: string;
  triggerType: string;
  calendarEventTitle?: string;
}

export interface GeneratedSummary {
  summaryText: string;
  topApps: { name: string; duration: number }[];
  productiveTimeSeconds: number;
  idleTimeSeconds: number;
  totalTimeSeconds: number;
  projectsDetected: string[];
  difficulties: string[];
  highlights: string[];
}

// ─── Summary Generator ──────────────────────────────────────────────

const SUMMARY_MODEL = 'gemini-2.5-flash';

export async function generateDailySummary(
  apiKey: string,
  activities: ActivityLogEntry[],
  sessionInfo: SessionInfo,
  irisProjects?: string[],
): Promise<GeneratedSummary> {
  if (activities.length === 0) {
    return {
      summaryText: 'No se registró actividad durante esta sesión.',
      topApps: [],
      productiveTimeSeconds: 0,
      idleTimeSeconds: 0,
      totalTimeSeconds: 0,
      projectsDetected: [],
      difficulties: [],
      highlights: [],
    };
  }

  // Pre-calculate stats
  const appUsage = new Map<string, number>();
  let totalIdle = 0;
  let totalActive = 0;

  for (const act of activities) {
    if (act.idle) {
      totalIdle += act.durationSeconds;
    } else {
      totalActive += act.durationSeconds;
      const current = appUsage.get(act.processName) || 0;
      appUsage.set(act.processName, current + act.durationSeconds);
    }
  }

  const topApps = Array.from(appUsage.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  // Build activity timeline for Gemini
  const timelineText = activities
    .filter(a => !a.idle)
    .map(a => {
      const time = new Date(a.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const ocrSnippet = a.ocrText ? ` | Texto visible: "${a.ocrText.slice(0, 200)}"` : '';
      return `${time} — ${a.processName}: ${a.windowTitle.slice(0, 100)}${a.url ? ` (${a.url})` : ''}${ocrSnippet}`;
    })
    .join('\n');

  const projectsContext = irisProjects?.length
    ? `\nPROYECTOS CONOCIDOS DEL USUARIO: ${irisProjects.join(', ')}`
    : '';

  const prompt = `Eres un analista de productividad. Genera un resumen detallado de la sesión de trabajo del usuario.

SESIÓN:
- Inicio: ${sessionInfo.startedAt}
- Fin: ${sessionInfo.endedAt || 'En curso'}
- Tipo: ${sessionInfo.triggerType === 'calendar_auto' ? 'Auto (calendario)' : 'Manual'}
${sessionInfo.calendarEventTitle ? `- Evento: ${sessionInfo.calendarEventTitle}` : ''}

ESTADÍSTICAS:
- Tiempo total: ${Math.round((totalActive + totalIdle) / 60)} minutos
- Tiempo activo: ${Math.round(totalActive / 60)} minutos
- Tiempo inactivo: ${Math.round(totalIdle / 60)} minutos
- Apps más usadas: ${topApps.slice(0, 5).map(a => `${a.name} (${Math.round(a.duration / 60)}min)`).join(', ')}
${projectsContext}

TIMELINE DE ACTIVIDAD:
${timelineText}

Genera un JSON con este formato exacto:
{
  "resumen": "Resumen de 3-5 oraciones describiendo qué hizo el usuario, en qué se enfocó, y cómo fue su productividad.",
  "proyectos_detectados": ["nombres de proyectos en los que trabajó"],
  "dificultades": ["problemas o bloqueos que parece haber tenido"],
  "logros": ["tareas completadas o avances significativos"],
  "recomendaciones": ["sugerencias para mejorar productividad"]
}

IMPORTANTE: Responde SOLO el JSON, sin texto adicional ni bloques de código.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON response
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const summaryParts = [
      parsed.resumen || '',
      '',
      parsed.logros?.length ? `*Logros:*\n${parsed.logros.map((l: string) => `  - ${l}`).join('\n')}` : '',
      parsed.dificultades?.length ? `*Dificultades:*\n${parsed.dificultades.map((d: string) => `  - ${d}`).join('\n')}` : '',
      parsed.recomendaciones?.length ? `*Recomendaciones:*\n${parsed.recomendaciones.map((r: string) => `  - ${r}`).join('\n')}` : '',
      '',
      `*Estadísticas:*`,
      `  Tiempo activo: ${Math.round(totalActive / 60)} min`,
      `  Tiempo inactivo: ${Math.round(totalIdle / 60)} min`,
      `  Apps: ${topApps.slice(0, 5).map(a => a.name).join(', ')}`,
    ].filter(Boolean).join('\n');

    return {
      summaryText: summaryParts,
      topApps,
      productiveTimeSeconds: totalActive,
      idleTimeSeconds: totalIdle,
      totalTimeSeconds: totalActive + totalIdle,
      projectsDetected: parsed.proyectos_detectados || [],
      difficulties: parsed.dificultades || [],
      highlights: parsed.logros || [],
    };
  } catch (err: any) {
    console.error('[SummaryGenerator] Gemini error:', err.message);
    // Fallback: generate basic summary without AI
    const fallbackSummary = `Sesión de trabajo: ${Math.round(totalActive / 60)} min activo, ${Math.round(totalIdle / 60)} min inactivo.\nApps: ${topApps.slice(0, 5).map(a => a.name).join(', ')}`;
    return {
      summaryText: fallbackSummary,
      topApps,
      productiveTimeSeconds: totalActive,
      idleTimeSeconds: totalIdle,
      totalTimeSeconds: totalActive + totalIdle,
      projectsDetected: [],
      difficulties: [],
      highlights: [],
    };
  }
}

/**
 * Categorize activities using Gemini (batch).
 * Returns a map of processName → category.
 */
export async function categorizeActivities(
  apiKey: string,
  processNames: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(processNames)];
  const result = new Map<string, string>();

  if (unique.length === 0) return result;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });

    const prompt = `Clasifica cada aplicación como "productive", "unproductive", o "neutral".
Aplicaciones: ${unique.join(', ')}

Responde SOLO un JSON: {"app_name": "category", ...}`;

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    for (const [app, category] of Object.entries(parsed)) {
      result.set(app, category as string);
    }
  } catch (err: any) {
    console.error('[SummaryGenerator] Categorization error:', err.message);
    // Default all to uncategorized
    for (const name of unique) {
      result.set(name, 'uncategorized');
    }
  }

  return result;
}
