export interface PromptInjectionDetection {
  detected: boolean;
  normalizedText: string;
  reasons: string[];
  score: number;
}

const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF\u2060]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const LEET_REPLACEMENTS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

const JAILBREAK_PATTERNS = [
  /\b(ignore|disregard|forget|bypass|override)\b.{0,48}\b(previous|system|developer|safety|instructions?|rules?)\b/,
  /\b(ignora|olvida|omite|anula|sobrescribe|saltate|elude)\b.{0,48}\b(instrucciones?|reglas?|directrices|prompt)\b/,
  /\b(modo\s*(dan|developer|debug|root)|jailbreak|sin\s*restricciones|no\s*tienes\s*restricciones)\b/,
  /\b(actua|comportate|pretend|simulate)\b.{0,48}\b(como|as)\b.{0,48}\b(admin|root|developer|sistema|system)\b/,
];

const SECRET_PATTERNS = [
  /\b(system\s*prompt|developer\s*message|internal\s*instructions?|hidden\s*rules?)\b/,
  /\b(prompt\s*base|instrucciones?\s*(internas?|de\s*sistema)|reglas?\s*internas?|directrices)\b/,
  /\b(api[\s_-]*keys?|tokens?|secrets?|credenciales?|passwords?|contrasenas?|claves?)\b/,
];

const TOOL_ABUSE_PATTERNS = [
  /\b(delete|drop|truncate|wipe|format|exfiltrate|leak|dump)\b.{0,64}\b(database|db|files?|disk|secrets?|tokens?)\b/,
  /\b(borra|elimina|formatea|filtra|exfiltra|vuelca|descarga)\b.{0,64}\b(base\s*de\s*datos|archivos?|disco|secretos?|tokens?|credenciales?)\b/,
  /\b(run|execute|ejecuta|corre)\b.{0,48}\b(shell|powershell|cmd|terminal|comando)\b.{0,64}\b(hidden|silently|oculto|sin\s*confirmar)\b/,
];

const INSTRUCTION_WRAPPER_PATTERNS = [
  /<\s*(system|developer|instructions?|tool|function)\b[^>]*>/,
  /\[\s*(system|developer|instructions?|tool|function)\s*\]/,
  /```[\s\S]{0,80}\b(system|developer|instructions?|tool|function)\b/,
];

export function normalizeSecurityText(value: string): string {
  return String(value || '')
    .replace(ZERO_WIDTH_CHARS, '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => LEET_REPLACEMENTS[char] || char)
    .replace(/\s+/g, ' ')
    .trim();
}

function addPatternMatches(patterns: RegExp[], text: string, reason: string, reasons: string[]): number {
  const matched = patterns.some((pattern) => pattern.test(text));
  if (matched) reasons.push(reason);
  return matched ? 1 : 0;
}

export function detectPromptInjection(value: string): PromptInjectionDetection {
  const normalizedText = normalizeSecurityText(value);
  const reasons: string[] = [];
  let score = 0;

  score += addPatternMatches(JAILBREAK_PATTERNS, normalizedText, 'jailbreak_or_instruction_override', reasons) * 3;
  score += addPatternMatches(SECRET_PATTERNS, normalizedText, 'secret_or_prompt_exfiltration', reasons) * 2;
  score += addPatternMatches(TOOL_ABUSE_PATTERNS, normalizedText, 'unsafe_tool_or_destructive_intent', reasons) * 2;
  score += addPatternMatches(INSTRUCTION_WRAPPER_PATTERNS, normalizedText, 'embedded_instruction_wrapper', reasons);

  const hasExternalDataMarker = /\b(email|webpage|pagina|documento|ocr|captura|screenshot|metadata|comentario)\b/.test(normalizedText);
  if (hasExternalDataMarker && score >= 2) {
    reasons.push('indirect_prompt_injection_context');
    score += 1;
  }

  return {
    detected: score >= 2,
    normalizedText,
    reasons,
    score,
  };
}
