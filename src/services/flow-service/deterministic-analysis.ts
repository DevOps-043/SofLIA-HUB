import type { FlowAnalysisResult } from './types';
import { buildDesktopAutomationAnalysis, buildDirectOpenAnalysis } from './direct-analysis';
import { normalizePotentialUrl, resolveKnownTargetUrl, stripTrailingPunctuation } from './target-url';

export function buildDeterministicAnalysis(transcript: string): FlowAnalysisResult | null {
  const normalized = transcript.trim();
  if (!normalized) {
    return null;
  }

  const openMatch = normalized.match(/^(?:abre|abrir)\s+(.+)$/i);
  if (!openMatch) {
    const automationStarts =
      /^(?:busca|buscar|entra|entrar|ve a|ir a|navega|navegar|selecciona|seleccionar|haz|hacer|mueve|desplazate|desplázate|cierra|cerrar)\b/i;
    const mentionsUIContext =
      /\b(chatgpt|gmail|outlook|whatsapp|chrome|edge|ventana|pestana|pestaña|conversacion|conversación|chat|pagina|página|sitio)\b/i;
    if (automationStarts.test(normalized) && mentionsUIContext.test(normalized)) {
      return buildDesktopAutomationAnalysis(normalized);
    }
    return null;
  }

  const rawTarget = stripTrailingPunctuation(openMatch[1] || '');
  if (!rawTarget) {
    return null;
  }

  const isCompoundTask =
    /\b(y|luego|despues|después)\b/i.test(rawTarget) ||
    /\b(busca|buscar|selecciona|seleccionar|escribe|escribir|navega|navegar|entra|entrar|ve a|ir a)\b/i.test(rawTarget);
  if (isCompoundTask) {
    return buildDesktopAutomationAnalysis(
      normalized,
      'Voy a abrir lo necesario y tratar de completar esa accion en tu escritorio.',
    );
  }

  const knownUrl = resolveKnownTargetUrl(rawTarget);
  if (knownUrl) {
    return buildDirectOpenAnalysis(transcript, knownUrl, 'open_url');
  }

  const url = normalizePotentialUrl(rawTarget);
  return url
    ? buildDirectOpenAnalysis(transcript, url, 'open_url')
    : buildDirectOpenAnalysis(transcript, rawTarget, 'open_application');
}

export function shouldAttachScreenshot(transcript: string): boolean {
  const normalized = transcript.toLowerCase();
  return [
    'pantalla',
    'imagen',
    'captura',
    'aqui',
    'aquí',
    'esto que ves',
    'ves aqui',
    'ves aquí',
    'esta ventana',
    'esta pagina',
    'esta página',
    'este boton',
    'este botón',
    'este campo',
    'seleccionado',
    'selecciona',
    'haz click aqui',
    'haz click aquí',
  ].some((signal) => normalized.includes(signal));
}
