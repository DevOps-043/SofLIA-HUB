export function normalizePhoneNumber(value: string): string {
  return String(value || '').replace(/\D/g, '').trim();
}

export function numbersMatch(allowed: string, number: string): boolean {
  const allowedDigits = normalizePhoneNumber(allowed);
  const numberDigits = normalizePhoneNumber(number);
  if (!allowedDigits || !numberDigits) return false;
  if (allowedDigits === numberDigits) return true;
  if (numberDigits.endsWith(allowedDigits) || allowedDigits.endsWith(numberDigits)) return true;
  return allowedDigits.length >= 10 && numberDigits.length >= 10 &&
    allowedDigits.slice(-10) === numberDigits.slice(-10);
}
