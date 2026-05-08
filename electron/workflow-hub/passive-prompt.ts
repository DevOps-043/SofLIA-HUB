import { normalizeOptionalString } from './normalizers';
import type { WorkflowId } from './types';

export function resolvePassivePrompt(input: {
  workflowId: WorkflowId | null;
  prompt: string | null;
  config: Record<string, unknown>;
}): string {
  const explicitPrompt = normalizeOptionalString(input.prompt);
  if (explicitPrompt) return explicitPrompt;
  if (!input.workflowId) {
    throw new Error('Necesito la instruccion que quieres recordar o automatizar.');
  }

  switch (input.workflowId) {
    case 'correo': {
      const preset = String(input.config.preset || 'unread');
      const maxResults = Number(input.config.maxResults || 5);
      const presetCopy = preset === 'priority'
        ? 'prioritarios'
        : preset === 'today'
          ? 'de hoy'
          : preset === 'custom'
            ? `que cumplan el filtro "${String(input.config.query || '').trim()}"`
            : 'no leidos';
      return `Dame un resumen ejecutivo de mis correos ${presetCopy}. Prioriza lo accionable, limita la revision a ${maxResults} resultados y responde por WhatsApp con lo mas importante.`;
    }
    case 'agenda': {
      const targetDate = normalizeOptionalString(input.config.targetDate);
      return `Dame un briefing ejecutivo de mi agenda ${targetDate ? `para ${targetDate}` : 'de hoy'}, con riesgos, prioridades y reuniones importantes. Responde por WhatsApp.`;
    }
    default:
      throw new Error('Ese workflow no soporta programacion pasiva desde la app.');
  }
}
