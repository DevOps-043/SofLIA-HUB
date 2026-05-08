const LONG_SECRET_REGEX = /[A-Za-z0-9-_]{25,}/;
const SENSITIVE_TEXT_REGEX = /(password|contrase\u00f1a|token|api_key|secret|bearer|tarjeta|cvv|clave|key)/i;

export function sanitizeClipboardLogText(text: string): string {
  if (LONG_SECRET_REGEX.test(text) || SENSITIVE_TEXT_REGEX.test(text)) {
    return '***[INFORMACION_SENSIBLE_OCULTA]***';
  }

  const singleLine = text.replace(/\n/g, ' ');
  return singleLine.length > 50 ? `${singleLine.substring(0, 50)}...` : singleLine;
}

export function sanitizeSearchLogText(query: string, resultText: string): string {
  if (SENSITIVE_TEXT_REGEX.test(query) || LONG_SECRET_REGEX.test(resultText)) {
    return '***[SENSIBLE_MASKED]***';
  }

  const singleLine = resultText.replace(/\n/g, ' ');
  return singleLine.length > 50 ? `${singleLine.substring(0, 50)}...` : singleLine;
}
