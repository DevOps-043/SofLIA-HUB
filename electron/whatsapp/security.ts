import type { WhatsAppConfig } from './types';

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
  if (!config.allowedNumbers || config.allowedNumbers.length === 0) return true;
  const numberDigits = number.replace(/\D/g, '');
  return config.allowedNumbers.some((allowed) => numbersMatch(allowed, numberDigits));
}

export function isAllowedGroupSender(config: WhatsAppConfig, senderNumber: string): boolean {
  const allowed = config.groupAllowFrom || [];
  if (config.groupPolicy !== 'allowlist' || allowed.length === 0) return true;
  return allowed.some((candidate) => candidate === '*' || numbersMatch(candidate, senderNumber.replace(/\D/g, '')));
}

function numbersMatch(allowed: string, numberDigits: string): boolean {
  const allowedDigits = allowed.replace(/\D/g, '').trim();
  if (allowedDigits === numberDigits) return true;
  if (numberDigits.endsWith(allowedDigits) || allowedDigits.endsWith(numberDigits)) return true;
  return allowedDigits.length >= 10 && numberDigits.length >= 10 &&
    allowedDigits.slice(-10) === numberDigits.slice(-10);
}
