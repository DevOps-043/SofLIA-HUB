export type EvidenceRequirement =
  | 'none'
  | 'local'
  | 'local_visual'
  | 'remote'
  | 'local_then_remote'
  | 'local_visual_then_remote';

function normalizeIntentText(message: string): string {
  return message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function classifyEvidenceRequirement(message: string): EvidenceRequirement {
  const normalized = normalizeIntentText(message);
  const hasVerificationIntent = /\b(revisa(?:r)?|verifica(?:r)?|comprueba(?:r)?|confirma(?:r)?|checa(?:r)?|valida(?:r)?|asegura(?:r)?|corrobora(?:r)?)\b/.test(normalized);
  const hasComparisonIntent = /\b(vs|contra|compara|comparar|sincronizad|alinead|igual que|mismo que)\b/.test(normalized);
  const hasVisualLocalContext =
    /\b(dentro de la aplicacion|dentro del programa|en la aplicacion|en el programa|en la ventana|en pantalla|en el monitor|en el monitor 2|en la segunda pantalla|visualmente|a simple vista|ya abierta|ya abierto)\b/.test(normalized);
  const hasLocalContext =
    /\b(local|localmente|en mi computadora|en la computadora|en mi compu|en la compu|en mi pc|en la pc|en el equipo|en mi equipo|en escritorio|dentro de la aplicacion|dentro del programa|en la aplicacion|en el programa|en el sistema|instalad[oa])\b/.test(normalized);
  const hasRemoteContext =
    /\b(github|gitlab|bitbucket|repo|repositorio|nube|cloud|remot[oa]|en linea|online|web|pagina|sitio|portal|servidor)\b/.test(normalized);
  const hasFreshExternalInfoIntent =
    /\b(noticias?|news|actualidad|hoy|reciente|ultim[oa]s?|tendencias?|mercado|clima|precio|cotizacion|curios[oa]s?|dato curioso|efemerides)\b/.test(normalized);

  if (hasFreshExternalInfoIntent) {
    return 'remote';
  }
  if ((hasVerificationIntent || hasComparisonIntent) && hasVisualLocalContext && hasRemoteContext) {
    return 'local_visual_then_remote';
  }
  if ((hasVerificationIntent || hasComparisonIntent) && hasVisualLocalContext) {
    return 'local_visual';
  }
  if ((hasVerificationIntent || hasComparisonIntent) && hasLocalContext && hasRemoteContext) {
    return 'local_then_remote';
  }
  if ((hasVerificationIntent || hasComparisonIntent) && hasLocalContext) {
    return 'local';
  }
  if ((hasVerificationIntent || hasComparisonIntent) && hasRemoteContext) {
    return 'remote';
  }

  return 'none';
}
