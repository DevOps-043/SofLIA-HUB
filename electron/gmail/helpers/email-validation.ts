import { ANGLE_EMAIL_REGEX, STRICT_EMAIL_REGEX } from './email-patterns';

export function isValidEmail(email: string): boolean {
  const match = email.match(ANGLE_EMAIL_REGEX);
  const extracted = match ? match[1].trim() : email.trim();

  if (!STRICT_EMAIL_REGEX.test(extracted)) return false;
  if (/[\r\n"]/.test(email)) return false;

  return true;
}
