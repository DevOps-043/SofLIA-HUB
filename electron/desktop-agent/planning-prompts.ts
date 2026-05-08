import type { ActionHistoryEntry, TaskPhase } from '../desktop-agent-types';

export function buildStrategicPlanPrompt(task: string): string {
  return `Analiza la pantalla actual y la tarea solicitada.
TAREA: ${task}

Descompone la tarea en fases de alto nivel. Cada fase es un objetivo independiente
con criterios de exito claros sobre lo que debe verse en pantalla.

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "goal": "objetivo principal",
  "phases": [
    {
      "name": "nombre corto de la fase",
      "description": "descripcion detallada",
      "successCriteria": "que debe verse en pantalla cuando esta fase este completa",
      "subGoals": ["paso 1", "paso 2", "..."],
      "estimatedSteps": number
    }
  ],
  "totalEstimatedSteps": number
}`;
}

export function buildFlatPlanPrompt(task: string): string {
  return `Analiza la pantalla actual y la tarea solicitada.
TAREA: ${task}

Descompone la tarea en sub-objetivos claros y ordenados.
Cada sub-objetivo debe ser una accion concreta y verificable.

Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "goal": "objetivo principal",
  "subGoals": ["paso 1: ...", "paso 2: ..."],
  "estimatedSteps": number
}`;
}

export function buildHistorySummaryPrompt(
  stepsToSummarize: ActionHistoryEntry[],
  fromStep: number,
  toStep: number,
): string {
  const stepsText = stepsToSummarize.map(entry => {
    const action = entry.action;
    const point = action.x !== undefined ? ` (${action.x},${action.y})` : '';
    const result = entry.success ? 'ok' : 'fallo';
    return `${action.action}${point} - ${result} ${action.message}`;
  }).join('\n');

  return `Resume estas acciones de control de escritorio en 2-3 oraciones cortas en espanol.
Que se logro? Que fallo?

Acciones (pasos ${fromStep + 1} a ${toStep + 1}):
${stepsText}

Responde SOLO con el resumen, sin JSON.`;
}

export function buildPhaseCompletionPrompt(phase: TaskPhase): string {
  return `VERIFICACION DE FASE.

Fase actual: "${phase.name}"
Criterio de exito: "${phase.successCriteria}"

La pantalla actual muestra que el criterio de exito se cumplio?
Responde SOLO con JSON: {"completed": true/false, "reason": "..."}`;
}
