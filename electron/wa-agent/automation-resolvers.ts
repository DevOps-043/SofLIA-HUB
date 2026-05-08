/**
 * Resolutores puros para automatizaciones solicitadas desde WhatsApp.
 *
 * Mantienen aisladas las reglas de interpretacion de argumentos para que el
 * agente principal no mezcle parsing de comandos con el loop conversacional.
 */

export function resolveAutomationMailQuery(args: string[]): string {
  const raw = args.join(' ').trim();
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!normalized || normalized === 'hoy') {
    return 'in:inbox newer_than:1d';
  }
  if (
    normalized === 'noleidos'
    || normalized === 'no leidos'
    || normalized === 'pendientes'
    || normalized === 'sin responder'
  ) {
    return 'in:inbox is:unread newer_than:7d';
  }
  if (
    normalized === 'importantes'
    || normalized === 'clientes'
    || normalized === 'prioritarios'
  ) {
    return 'in:inbox category:primary newer_than:7d';
  }

  return raw;
}

export function resolveAutomationBriefDate(args: string[]): string | undefined {
  const raw = args.join(' ').trim();
  if (!raw) {
    return undefined;
  }

  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'hoy') {
    return formatDateOnly(new Date());
  }

  if (normalized === 'manana') {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return formatDateOnly(nextDay);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return undefined;
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
