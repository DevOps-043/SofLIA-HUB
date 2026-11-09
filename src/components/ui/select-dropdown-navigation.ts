export interface SelectDropdownOption {
  value: string;
  label: string;
  /** Línea secundaria dentro de la opción. */
  description?: string;
  disabled?: boolean;
}

/** Salta opciones deshabilitadas y permite recorrer en ambos sentidos. */
export function nextEnabledOption(options: SelectDropdownOption[], from: number, step: 1 | -1): number {
  const total = options.length;
  const start = from < 0 ? (step === 1 ? -1 : 0) : from;
  for (let offset = 1; offset <= total; offset++) {
    const index = (((start + step * offset) % total) + total) % total;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export function activeOptionIndex(options: SelectDropdownOption[], activeValue: string | null, value: string): number {
  const active = options.findIndex(option => option.value === activeValue && !option.disabled);
  if (active >= 0) return active;
  const selected = options.findIndex(option => option.value === value && !option.disabled);
  return selected >= 0 ? selected : nextEnabledOption(options, -1, 1);
}

export function normalizeOptionPrefix(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function findPrefixOption(options: SelectDropdownOption[], prefix: string, from: number, includeCurrent: boolean): number {
  const start = from >= 0 ? from : 0;
  for (let offset = includeCurrent ? 0 : 1; offset < options.length + (includeCurrent ? 0 : 1); offset++) {
    const index = (start + offset) % options.length;
    const option = options[index];
    if (!option.disabled && normalizeOptionPrefix(option.label).startsWith(prefix)) return index;
  }
  return -1;
}
