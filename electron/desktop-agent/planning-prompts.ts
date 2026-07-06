import type { ActionHistoryEntry, TaskPhase } from '../desktop-agent-types';

export type PlanPromptOptions = {
  /** Seccion "CONTEXTO DEL EQUIPO" ya formateada (ventanas, monitores, apps). */
  contextoEntorno?: string;
  /** Instruir al planner a preferir open_application/open_url sobre clicks visuales. */
  deterministaPrimero?: boolean;
};

const DETERMINISTIC_PLANNING_GUIDANCE = `Planifica como un usuario que conoce su maquina:
- Si una fase requiere abrir una aplicacion, usa la accion open_application (con el nombre de la app) en UN solo paso.
- Si requiere abrir un sitio web, usa open_url con la URL completa en UN solo paso.
- NUNCA planifiques buscar iconos en la barra de tareas ni en el menu inicio.
- Si la ventana ya aparece en el contexto como abierta, planifica focus_window en lugar de abrir otra instancia.
Para cada fase puedes indicar "backendPreferido": "browser" (portales web complejos), "uia" (apps nativas de Windows con controles estandar) o "desktop" (superficies visuales sin alternativa).`;

function buildPlanPreamble(task: string, options?: PlanPromptOptions): string {
  const contexto = options?.contextoEntorno ? `\n${options.contextoEntorno}\n` : '';
  const guidance = options?.deterministaPrimero ? `\n${DETERMINISTIC_PLANNING_GUIDANCE}\n` : '';
  return `Analiza la pantalla actual y la tarea solicitada.
TAREA: ${task}
${contexto}${guidance}`;
}

export function buildStrategicPlanPrompt(task: string, options?: PlanPromptOptions): string {
  return `${buildPlanPreamble(task, options)}
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
      "estimatedSteps": number,
      "backendPreferido": "browser|uia|desktop"
    }
  ],
  "totalEstimatedSteps": number
}`;
}

export function buildFlatPlanPrompt(task: string, options?: PlanPromptOptions): string {
  return `${buildPlanPreamble(task, options)}
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
