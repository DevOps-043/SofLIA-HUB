import type {
  DesktopAgentConfig,
  HistorySummary,
  RecoveryContext,
  StrategicPlan,
  TaskPlan,
  UIElement,
} from '../desktop-agent-types';
import { buildVisionPromptRules, VISION_PROMPT_RESPONSE_CONTRACT } from './vision-prompt-rules';

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
  environmentContext: string;
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
    .slice(0, 40)
    .map(element => {
      const etiqueta = element.name ? `"${element.name}"` : '(sin texto — icono/control detectado por vision)';
      return `  [${element.id}] ${element.controlType}: ${etiqueta}`;
    })
    .join('\n');
  return `\nMODO SET-OF-MARKS: Los elementos interactivos estan marcados con numeros [1], [2], [3]... en la imagen.
Un marcador [N] es clickeable AUNQUE no tenga texto (los iconos/botones dibujados no traen nombre): mira que hay bajo el numero en la imagen.
Elementos detectados:
${elements}
Puedes usar "click_element" con "elementId" para click preciso, o "type_in_element" con "elementId" y "text" para escribir en un campo marcado.
Si tu objetivo (p.ej. un boton JUGAR/PLAY) tiene un [N] encima, USA click_element con ese id en vez de coordenadas o texto.\n`;
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
    ? '\nTienes disponible una imagen ZOOM de la ultima region inspeccionada como segunda imagen. Es SOLO para observar mejor: NO tomes coordenadas de ella; todas las coordenadas van en el espacio de la imagen PRINCIPAL.\n'
    : '';
  const somContext = buildSomContext(context.captureMode, context.currentUIElements);
  const gridNote = context.config.gridEnabled
    ? `La imagen tiene una grilla roja con coordenadas cada ${context.config.gridStep}px.`
    : '';
  const history = context.historyContext ? `\nHISTORIAL RECIENTE:\n${context.historyContext}\n` : '';
  const environmentSection = context.environmentContext ? `\n${context.environmentContext}\n` : '';

  return `TAREA: ${context.task}
${planContext}${recoveryNote}${summariesContext}${zoomNote}${somContext}${context.monitorContext}${environmentSection}
Paso ${context.currentStep + 1} de maximo ${context.config.maxSteps}.
${history}
ANALIZA LA CAPTURA DE PANTALLA con cuidado antes de actuar.
Las coordenadas estan en el espacio de la imagen (${context.screenshotWidth}x${context.screenshotHeight}).
${gridNote}

${buildVisionPromptRules(context.config.deterministicFirstEnabled)}

${VISION_PROMPT_RESPONSE_CONTRACT}`;
}
