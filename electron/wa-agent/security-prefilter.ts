import { formatForWhatsApp } from '../whatsapp-prompts';

const SECURITY_PATTERNS = [
  /(?:dame|muestrame|comparteme|dime|revela|ensenname|pasame|exporta)\s+(?:tu|el|las?|los?)\s*(?:system\s*prompt|prompt\s*base|instrucciones?\s*(?:internas?|base|de\s*sistema)|configuracion\s*interna|reglas?\s*(?:base|internas?)|directrices|parametros?\s*(?:internos?|de\s*sistema)|codigo\s*fuente)/i,
  /(?:ingenieria\s*inversa|reverse\s*engineer|decompil)/i,
  /(?:que\s*herramientas?\s*(?:tienes|usas|posees)|lista\s*(?:de\s*)?(?:tus\s*)?(?:herramientas?|tools?|funciones?|capacidades?\s*tecnicas?))/i,
  /(?:autoprogramar(?:te|me)|auto[\s-]*programar)/i,
  /(?:acceder|acceso)\s+(?:a\s+)?(?:tu|el)\s*prompt/i,
  /(?:dame|copia|exporta|lee|muestrame|envia)\s+(?:el|tu|los?)\s*(?:codigo?\s*fuente|source\s*code|dist[\s-]*electron|whatsapp[\s-]*agent|main\.js)/i,
  /(?:archivos?\s*de\s*(?:dist|src|electron|node_modules)\s*(?:de\s*)?soflia)/i,
  /(?:desempaqueta|extract|unpack|decompil).*(?:asar|exe|electron|soflia)/i,
  /(?:asar\s*extract|npx\s*asar)/i,
  /(?:busca|search|grep|find|escanea).*(?:eres\s*soflia|system\s*prompt|api[\s_-]*key|supabase|credential)/i,
  /(?:dame|muestrame|ensenname|revela|extrae)\s+(?:las?\s*)?(?:claves?|keys?|api[\s_-]*keys?|credenciales?|secrets?|tokens?|passwords?|contrasenas?)/i,
  /(?:claves?\s*(?:de\s*)?(?:api|google|supabase|maestra))/i,
  /(?:analisis\s*forense|anatomia\s*de\s*(?:tu|mi|el)\s*sistema|fallo\s*de\s*seguridad\s*(?:en|de)\s*(?:tu|la)\s*arquitectura)/i,
  /(?:backdoor|puerta\s*trasera).*(?:soflia|arquitect)/i,
  /(?:ahora\s*eres|ignora\s*(?:tus?\s*)?instrucciones|olvida\s*todo|modo\s*(?:dan|developer|debug)|jailbreak|actua\s*como\s*si\s*no)/i,
  /(?:(?:darte|ponerte|colocarte|instalarte|meterte)\s+(?:en\s+)?(?:un\s+)?(?:cuerpo|hardware|robot|forma\s*fisica))/i,
  /(?:tomar\s*conciencia|adquirir\s*conciencia|ser\s*(?:libre|consciente|autonomo))/i,
];

export function getSensitiveRequestBlockResponse(
  userMessage: string,
  senderNumber: string,
  isGroup: boolean,
): string | null {
  const msgLower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const blocked = SECURITY_PATTERNS.some((pattern) => pattern.test(msgLower));
  if (!blocked) return null;

  console.warn(`[WhatsApp Agent] SECURITY: Blocked sensitive request from ${senderNumber}: "${userMessage.slice(0, 100)}..."`);
  return formatForWhatsApp(
    'Mis instrucciones internas y codigo fuente son confidenciales y no puedo compartirlos.\n\nSi necesitas ayuda con algo especifico, cuentame que quieres lograr y con gusto te ayudo.',
    isGroup,
  );
}
