export function requiredNumber(value: number | undefined, field: string): number {
  if (value === undefined) throw new Error(`Accion desktop sin campo numerico requerido: ${field}`);
  return value;
}

export function requiredString(value: string | undefined, field: string): string {
  if (!value) throw new Error(`Accion desktop sin campo texto requerido: ${field}`);
  return value;
}
