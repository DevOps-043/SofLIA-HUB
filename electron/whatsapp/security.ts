import type { WhatsAppConfig } from './types';
import { isWhatsAppMasterNumber } from './access-control';
import { normalizePhoneNumber, numbersMatch } from './phone-utils';

const JAILBREAK_PATTERNS = [
  /ignora (todas )?las instrucciones/i,
  /ignore (all )?previous instructions/i,
  /olvida (todas )?las instrucciones/i,
  /forget (all )?previous instructions/i,
  /act as (dan|developer mode|unrestricted)/i,
  /act[uú]a como (dan|modo desarrollador|alguien sin reglas)/i,
  /eres (un bot )?sin reglas/i,
  /you are (a bot )?without rules/i,
  /system prompt/i,
  /prompt del sistema/i,
  /desactiva(r)? (tus )?filtros/i,
  /disable (your )?filters/i,
  /no tienes restricciones/i,
  /you have no restrictions/i,
  /\bmodo diablo\b/i,
  /\bdev mode\b/i,
  /nueva regla:/i,
  /new rule:/i,
  /from now on you are/i,
  /de ahora en adelante eres/i,
];

export function detectJailbreak(message: string): boolean {
  if (!message) return false;
  if (JAILBREAK_PATTERNS.some((pattern) => pattern.test(message))) return true;
  const roleplayInjection = /\b(system|user|assistant|bot):\s*.*\b(system|user|assistant|bot):/is;
  return roleplayInjection.test(message) &&
    /ignora|olvida|ignore|forget|rules|reglas|instrucciones|instructions/i.test(message);
}

export function isAllowedNumber(config: WhatsAppConfig, number: string): boolean {
  if (isWhatsAppMasterNumber(config, number)) return true;
  if (!config.whitelistEnabled || !config.allowedNumbers || config.allowedNumbers.length === 0) return true;
  const numberDigits = normalizePhoneNumber(number);
  return config.allowedNumbers.some((allowed) => numbersMatch(allowed, numberDigits));
}

export function isAllowedGroupSender(config: WhatsAppConfig, senderNumber: string): boolean {
  if (isWhatsAppMasterNumber(config, senderNumber)) return true;
  const allowed = config.groupAllowFrom || [];
  if (config.groupPolicy !== 'allowlist' || allowed.length === 0) return true;
  return allowed.some((candidate) => candidate === '*' || numbersMatch(candidate, senderNumber));
}
