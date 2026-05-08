import { normalizeComparableText } from '../../whatsapp-text';

export function isGenericHelpResponse(text: string): boolean {
  const normalized = normalizeComparableText(text)
    .replace(/[!?.,\u00bf\u00a1]/g, '')
    .trim();
  return /^(hola )?(soy soflia )?(en que|como) puedo ayudarte( hoy)?$/.test(normalized);
}

export function isExecutionDeferralResponse(text: string): boolean {
  const normalized = normalizeComparableText(text);
  return /\b(voy a|hare|realizare|procedere|buscare|investigare|revisare|consultare|analizare|dame un momento|espera un momento|permiteme|me pongo a|voy a realizar una busqueda|voy a buscar|voy a investigar|voy a revisar|voy a analizar)\b/.test(
    normalized,
  );
}

export function isGreetingOrHelpRequest(text: string): boolean {
  const normalized = normalizeComparableText(text);
  return /^(hola|buenos dias|buenas tardes|buenas noches|hey|que puedes hacer|como puedes ayudarme|ayuda|help|menu|comandos|que haces)\b/.test(
    normalized,
  );
}
