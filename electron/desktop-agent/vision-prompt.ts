import type {
  DesktopAgentConfig,
  HistorySummary,
  RecoveryContext,
  StrategicPlan,
  TaskPlan,
  UIElement,
} from '../desktop-agent-types';
import { VISION_PROMPT_RESPONSE_CONTRACT, VISION_PROMPT_RULES } from './vision-prompt-rules';

export type VisionPromptContext = {
  task: string;
  recoveryContext: boolean;
  historyContext: string;
  strategicPlan: StrategicPlan | null;
  currentPlan: TaskPlan | null;
  recovery: RecoveryContext;
  historySummaries: HistorySummary[];
  hasZoomImage: boolean;
  captureMode: 'som' | 'grid';
  currentUIElements: UIElement[];
  screenshotWidth: number;
  screenshotHeight: number;
  monitorContext: string;
  currentStep: number;
  config: DesktopAgentConfig;
};

function buildPlanContext(strategicPlan: StrategicPlan | null, currentPlan: TaskPlan | null): string {
  if (strategicPlan) {
    const phaseLines = strategicPlan.phases.flatMap((phase, index) => {
      const marker = index === strategicPlan.currentPhaseIndex ? '>>>' : phase.status === 'completed' ? '[ok]' : '   ';
      const lines = [`${marker} Fase ${index + 1}: ${phase.name} [${phase.status}]`];
      if (index === strategicPlan.currentPhaseIndex) {
        lines.push(`    Criterio de exito: ${phase.successCriteria}`);
        lines.push(...phase.subGoals.map((goal, goalIndex) =>
          `    ${goalIndex === phase.currentSubGoalIndex ? '-> ' : '   '}${goalIndex + 1}. ${goal}`,
        ));
      }
      return lines;
    });
    return `\nPLAN ESTRATEGICO (${strategicPlan.phases.length} fases):\n${phaseLines.join('\n')}\n`;
  }

  if (!currentPlan) return '';
  const subGoals = currentPlan.subGoals.map((goal, index) =>
    `${index === currentPlan.currentSubGoalIndex ? '>>> ' : '    '}${index + 1}. ${goal}`,
  );
  return `\nPLAN (sub-objetivos):\n${subGoals.join('\n')}\n`;
}

function buildSomContext(captureMode: 'som' | 'grid', currentUIElements: UIElement[]): string {
  if (captureMode !== 'som' || currentUIElements.length === 0) return '';
  const elements = currentUIElements
    .slice(0, 20)
    .map(element => `  [${element.id}] ${element.controlType}: "${element.name}"`)
    .join('\n');
  return `\nMODO SET-OF-MARKS: Los elementos interactivos estan marcados con numeros [1], [2], [3] en la imagen.
Elementos detectados:
${elements}
Puedes usar "click_element" con "elementId" para click preciso.
Puedes usar "type_in_element" con "elementId" y "text" para escribir en un campo marcado.
Prefiere click_element/type_in_element sobre coordenadas cuando haya marcadores.\n`;
}

export function buildVisionPrompt(context: VisionPromptContext): string {
  const planContext = buildPlanContext(context.strategicPlan, context.currentPlan);
  const recoveryNote = context.recoveryContext
    ? `\nATENCION: Las ultimas acciones fallaron (${context.recovery.consecutiveFailures} fallos). Analiza con cuidado y considera otro enfoque.\n`
    : '';
  const summariesContext = context.historySummaries.length > 0
    ? `\nRESUMENES DE PROGRESO:\n${context.historySummaries.map(s => `[Pasos ${s.fromStep + 1}-${s.toStep + 1}]: ${s.summary}`).join('\n')}\n`
    : '';
  const zoomNote = context.hasZoomImage
    ? '\nTienes disponible una imagen ZOOM de la ultima region inspeccionada como segunda imagen.\n'
    : '';
  const somContext = buildSomContext(context.captureMode, context.currentUIElements);
  const gridNote = context.config.gridEnabled
    ? `La imagen tiene una grilla roja con coordenadas cada ${context.config.gridStep}px.`
    : '';
  const history = context.historyContext ? `\nHISTORIAL RECIENTE:\n${context.historyContext}\n` : '';

  return `TAREA: ${context.task}
${planContext}${recoveryNote}${summariesContext}${zoomNote}${somContext}${context.monitorContext}
Paso ${context.currentStep + 1} de maximo ${context.config.maxSteps}.
${history}
ANALIZA LA CAPTURA DE PANTALLA con cuidado antes de actuar.
Las coordenadas estan en el espacio de la imagen (${context.screenshotWidth}x${context.screenshotHeight}).
${gridNote}

${VISION_PROMPT_RULES}

${VISION_PROMPT_RESPONSE_CONTRACT}`;
}
