const MAX_COMMAND_LENGTH = 4_000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(format|diskpart|bcdedit|sfc)\b/i, reason: 'operacion critica del sistema' },
  { pattern: /\bcipher\s+\/w\b/i, reason: 'borrado seguro de disco' },
  { pattern: /\b(reg\s+(add|delete)|net\s+user|net\s+localgroup\s+administrators)\b/i, reason: 'cambio de privilegios o registro' },
  { pattern: /\bshutdown\b|\brestart-computer\b|\bstop-computer\b/i, reason: 'apagado o reinicio del equipo' },
  { pattern: /\btaskkill\b[\s\S]{0,80}\bexplorer(\.exe)?\b/i, reason: 'terminacion del shell de Windows' },
  { pattern: /\brd\s+\/s\s+\/q\s+[a-z]:\\/i, reason: 'borrado recursivo de unidad' },
  { pattern: /\bdel\s+\/f\s+\/s\s+\/q\s+[a-z]:\\/i, reason: 'borrado recursivo de unidad' },
  { pattern: /\brm\s+-rf\s+\/(?:\s|$)/i, reason: 'borrado recursivo raiz' },
  { pattern: /\bmkfs\b|\bdd\s+if\s*=/i, reason: 'escritura destructiva de dispositivo' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'fork bomb' },
  { pattern: /\b(set-executionpolicy|invoke-expression|iex)\b/i, reason: 'ejecucion dinamica riesgosa' },
  { pattern: /\bfrombase64string\b|(?:^|\s)-(?:encodedcommand|enc)\b(?:\s+[a-z0-9+/=]{8,})?/i, reason: 'payload ofuscado' },
  { pattern: /\b(downloadstring|invoke-webrequest|iwr|curl|wget)\b[\s\S]{0,160}\|\s*\b(powershell|pwsh|cmd|sh|bash|iex)\b/i, reason: 'descarga y ejecucion encadenada' },
  { pattern: /\b(get-content|type|cat)\b[\s\S]{0,160}(?:^|[\s"'])(\.env|id_rsa|secret|token|credential|password|api[_-]?key)\b[\s\S]{0,160}\b(curl|wget|invoke-webrequest|iwr)\b/i, reason: 'posible exfiltracion de secretos' },
];

export function validateCommandSafety(value: unknown): string {
  const command = String(value || '').trim();
  if (!command) throw new Error('Comando vacio no permitido.');
  if (command.length > MAX_COMMAND_LENGTH) throw new Error('Comando demasiado largo.');
  if (CONTROL_CHARS.test(command)) throw new Error('Comando contiene caracteres de control.');

  const match = DANGEROUS_COMMAND_PATTERNS.find(({ pattern }) => pattern.test(command));
  if (match) throw new Error(`Comando bloqueado por seguridad: ${match.reason}.`);
  return command;
}

export function isCommandBlocked(value: unknown): boolean {
  try {
    validateCommandSafety(value);
    return false;
  } catch {
    return true;
  }
}
