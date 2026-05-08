import { PRIMARY_CHAT_PROMPT } from '../../prompts/chat';
import type { SendMessageStreamOptions } from './types';

const DEEP_ANALYSIS_TRIGGERS = [
  'analiza profundamente', 'analiza a fondo', 'analisis profundo', 'analisis detallado',
  'analizar profundamente', 'analizar a fondo', 'analisis exhaustivo', 'analiza completamente',
  'analisis completo', 'profundiza', 'explica a fondo', 'explica en detalle',
  'explicacion detallada', 'quiero todos los detalles', 'dime todo sobre', 'cuentame todo',
  'analisis extenso', 'deep analysis', 'full analysis', 'dame un analisis completo',
];

function isDeepAnalysis(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return DEEP_ANALYSIS_TRIGGERS.some((trigger) => lower.includes(trigger));
}

export function buildSystemInstruction(message: string, options?: SendMessageStreamOptions): string {
  let systemInstruction = PRIMARY_CHAT_PROMPT;
  if (isDeepAnalysis(message)) {
    systemInstruction += '\n\nINSTRUCCION OBLIGATORIA: El usuario ha pedido un analisis profundo. Debes responder de forma exhaustiva y detallada.';
  }
  if (options?.personalization) {
    const p = options.personalization;
    systemInstruction += `\n\n=== PERSONALIZACION DEL USUARIO ===\n${p.nickname ? `Nombre: "${p.nickname}"` : ''}\n${p.occupation ? `Ocupacion: ${p.occupation}` : ''}\n${p.tone ? `Tono preferido: ${p.tone}` : ''}\n${p.instructions ? `Instrucciones personalizadas: ${p.instructions}` : ''}\n=====================================`;
  }
  if (options?.irisContext) systemInstruction += buildIrisRules(options.irisContext);
  if (options?.sourcesContext) systemInstruction += options.sourcesContext;
  if (options?.toolSystemPrompt) {
    systemInstruction += `\n\n=== INSTRUCCIONES DE HERRAMIENTA ACTIVA ===\n${options.toolSystemPrompt}\n=====================================`;
  }
  return systemInstruction;
}

function buildIrisRules(irisContext: string): string {
  return `\n\n=== CONTEXTO DEL PROJECT HUB (IRIS) ===\n${irisContext}\n=====================================\n\nREGLAS CRITICAS DE Project Hub (IRIS):\n1. NO ADIVINES: resuelve equipo, proyecto y responsable antes de crear o actualizar.\n2. CREACION DE PROYECTOS: si el usuario pide crear, usa la herramienta de creacion.\n3. COHERENCIA DE DOMINIO: no mezcles proyectos con equipos distintos.\n4. ASIGNACIONES: si el responsable no queda claro, consulta miembros del equipo.`;
}
