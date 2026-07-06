import type {
  ActionHistoryEntry,
  DesktopAgentConfig,
  RecoveryContext,
  TaskPlan,
} from '../desktop-agent-types';
import { DESKTOP_ACTIONS } from './action-types';

export type RecoveryPromptReason = 'stuck' | 'fail' | 'failures';

export type RecoveryPromptContext = {
  task: string;
  currentPlan: TaskPlan | null;
  actionHistory: ActionHistoryEntry[];
  recovery: RecoveryContext;
  currentStep: number;
  config: DesktopAgentConfig;
  reason: RecoveryPromptReason;
  failMessage?: string;
};

function buildRecentRecoveryHistory(actionHistory: ActionHistoryEntry[]): string {
  const lines = actionHistory.slice(-5).map(entry => {
    const action = entry.action;
    const point = action.x !== undefined ? ` (${action.x},${action.y})` : '';
    const result = entry.success ? 'ok' : `fallo ${entry.errorMessage || ''}`.trim();
    return `  ${action.action}${point} - ${result} ${action.message}`;
  });

  return lines.join('\n') || '(sin historial)';
}

function describeRecoveryReason(context: RecoveryPromptContext): string {
  if (context.reason === 'stuck') {
    return `La pantalla no ha cambiado en ${context.recovery.sameScreenCount} pasos consecutivos. El agente esta atascado.`;
  }
  if (context.reason === 'failures') {
    return `Las ultimas ${context.recovery.consecutiveFailures} acciones fallaron consecutivamente.`;
  }
  return `El analisis determino que la tarea fallo: "${context.failMessage || ''}"`;
}

function buildPlanLine(currentPlan: TaskPlan | null): string {
  if (!currentPlan) return '';
  const goals = currentPlan.subGoals
    .map((goal, index) => `${index === currentPlan.currentSubGoalIndex ? '>>> ' : ''}${goal}`)
    .join(' | ');
  return `PLAN ACTUAL: ${goals}\n`;
}

export function buildRecoveryPrompt(context: RecoveryPromptContext): string {
  return `MODO RECUPERACION PROACTIVA.

TAREA ORIGINAL: ${context.task}
${buildPlanLine(context.currentPlan)}
PROBLEMA: ${describeRecoveryReason(context)}

HISTORIAL RECIENTE:
${buildRecentRecoveryHistory(context.actionHistory)}

Paso actual: ${context.currentStep + 1}/${context.config.maxSteps}
Recuperaciones previas: ${context.recovery.totalRecoveries - 1}

Analiza la captura de pantalla actual y decide la mejor estrategia de recuperacion.
No te rindas: busca una solucion alternativa.

Posibles estrategias:
1. Cerrar dialogos o popups inesperados.
2. Reintentar con coordenadas ligeramente distintas.
3. Abrir o enfocar la ventana esperada de otra forma.
4. Navegar a la pantalla correcta.
5. Enfocar un campo antes de escribir.
6. Usar alt+tab o focus_window si la app no responde.
7. Proponer un enfoque completamente diferente.

Responde SOLO con JSON:
{
  "strategy": "dismiss_dialog|retry_adjusted|navigate|refocus|alternative_approach|replan",
  "actions": [
    {"action": "${DESKTOP_ACTIONS.join('|')}", "x": ..., "y": ..., "text": "...", "key": "...", "message": "..."}
  ],
  "newSubGoals": ["..."],
  "reasoning": "explicacion de por que esta estrategia funcionara"
}`;
}
