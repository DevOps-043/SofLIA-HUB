import { DeterministicActionError } from './action-errors';

export function requiredNumber(value: number | undefined, field: string): number {
  if (value === undefined) throw new DeterministicActionError(`Accion desktop sin campo numerico requerido: ${field}`);
  return value;
}

export function requiredString(value: string | undefined, field: string): string {
  if (!value) throw new DeterministicActionError(`Accion desktop sin campo texto requerido: ${field}`);
  return value;
}
