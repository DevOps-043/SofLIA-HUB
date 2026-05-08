const ACTION_PATTERN = /\b(organiza|crea|envia|busca|descarga|sube|elimina|borra|abre|programa|mueve|copia|lee|revisa|hazme|necesito que|puedes|ayudame a|manda|pon|mete|clasifica|ordena|etiqueta|agenda|escribe|genera|analiza|enviar|crear|abrir|subir|descargar|mover|copiar|borrar|eliminar|organizar|etiquetar|clasificar|ordenar|vuelve a|hazlo otra vez|otra vez|repite|termina|continua|sigue con|saca|sacar|quita|quitar|intenta de nuevo|volver a intentar|rehaz|rehacer)\b/i;
const RESEARCH_PATTERN = /\b(investiga|investigar|averigua|averiguar|indaga|indagar|consulta|consultar|profundiza|profundizar)\b/i;

export function detectActionRequest(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return RESEARCH_PATTERN.test(normalized) || ACTION_PATTERN.test(normalized);
}
