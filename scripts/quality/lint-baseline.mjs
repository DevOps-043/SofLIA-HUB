/** Una línea base sólo es comparable cuando el analizador pudo completarla. */
export function assertAnalyzable(result, label) {
  if (result?.fatalErrorCount || result?.messages?.some(message => message.fatal)) {
    throw new Error('No se pudo analizar ' + label + '. El fallo del parser no es deuda aceptable.');
  }
}

export function newLintMessages(current, baseline) {
  assertAnalyzable(current, 'el archivo actual');
  assertAnalyzable(baseline, 'la línea base');
  const key = message => String(message.severity) + ':' + (message.ruleId ?? message.message);
  const counts = new Map();
  for (const message of baseline?.messages ?? []) counts.set(key(message), (counts.get(key(message)) ?? 0) + 1);
  return current.messages.filter(message => {
    const remaining = counts.get(key(message)) ?? 0;
    if (!remaining) return true;
    counts.set(key(message), remaining - 1); return false;
  });
}
