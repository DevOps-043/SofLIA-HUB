/**
 * Normalización de números de teléfono para comparación entre formatos.
 * Función pura — sin efectos secundarios.
 */

/**
 * Devuelve solo dígitos, sin código de país, limitado a los últimos 10 dígitos.
 * Compatible con la mayoría de variantes internacionales (+52, +1, etc.).
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}
