export type ConfirmationDecision = boolean | 'always';
export interface ConfirmationOptions { allowAlways?: boolean; command?: string }
export interface ConfirmationResult { confirmed: boolean; always?: boolean }

const READ_ONLY_COMMANDS = new Set([
  'dir', 'where', 'whoami', 'hostname', 'ver', 'systeminfo', 'tasklist',
  'ipconfig', 'echo', 'type', 'tree', 'findstr',
  'get-childitem', 'gci', 'ls', 'get-process', 'gps', 'get-item',
  'get-content', 'gc', 'cat', 'test-path', 'get-location', 'pwd', 'get-date',
]);

function unwrapCommand(command: string): string {
  return command.trim()
    .replace(/^cmd(\.exe)?\s+\/c\s+/i, '')
    .replace(/^powershell(\.exe)?\s+(-\w+\s+)*/i, '')
    .replace(/^"([\s\S]*)"$/, '$1').trim();
}

// Una expresión compuesta no tiene un alcance reutilizable verificable.
const ENCODED_COMMAND = /(?:^|\s)[-\u2010-\u2015\u2212](?:e|ec|en|enc|enco|encod|encode|encoded|encodedc|encodedco|encodedcom|encodedcomm|encodedcomma|encodedcomman|encodedcommand)\b/i;
const SCRIPT_FILE_COMMAND = /\b(?:powershell|pwsh)(?:\.exe)?\b[\s\S]*-(?:f|fi|fil|file)\b/i;
const COMPOSITE_COMMAND = /[&|<>^;`{}()\r\n]/;
const SENSITIVE_COMMAND = /\$env\s*:|\benv\s*:|\b(setx|set|export|unset|reg|regedit|set-itemproperty|new-itemproperty|remove-itemproperty|set-executionpolicy|invoke-expression|iex|format|diskpart|bcdedit|sfc|shutdown|restart-computer|stop-computer|net|netsh|sc|sudo|su|chmod|chown|mount|umount|mkfs|dd|remove-item|del|erase|rd|rmdir|rm|taskkill|stop-process|start-service|stop-service|set-service|new-service|remove-service)\b|setenvironmentvariable|frombase64string|hklm\s*:|hkcu\s*:|\\(?:windows|system32|syswow64)\\|\/etc\//i;

export function isReadOnlyCommand(command: string): boolean {
  if (!command.trim() || COMPOSITE_COMMAND.test(command) || hasEncodedCommand(command) || SCRIPT_FILE_COMMAND.test(command)) return false;
  if (/\bipconfig\b.*\/(?:release|renew|flushdns|registerdns|setclassid)/i.test(command)) return false;
  const first = unwrapCommand(command).split(/\s+/)[0]?.toLowerCase().replace(/^["']|["']$/g, '');
  return READ_ONLY_COMMANDS.has(first);
}

export function canRememberCommand(command: string): boolean {
  const opaqueSystemCommand = /\b(powershell|pwsh|python\d*|node|ruby|perl|wscript|cscript|rundll32|regsvr32|schtasks|wmic|powercfg|gpupdate|dism|msiexec|choco|winget|apt|systemctl)\b|\$profile\b|\.(?:ps1|bat|cmd|vbs)\b/i;
  return Boolean(command.trim()) && !COMPOSITE_COMMAND.test(command) && !hasEncodedCommand(command) && !SCRIPT_FILE_COMMAND.test(command) && !SENSITIVE_COMMAND.test(command) && !opaqueSystemCommand.test(command);
}

/** La shell elimina comillas de argumentos; una bandera citada sigue siendo ejecutable. */
export function hasEncodedCommand(command: string): boolean {
  return ENCODED_COMMAND.test(command.replace(/["']/g, ''));
}
