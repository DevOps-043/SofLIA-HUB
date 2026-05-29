const ACTION_PATTERN = /\b(organiza|crea|envia|enviame|mandame|pasame|comparteme|adjunta|busca|descarga|sube|elimina|borra|abre|programa|mueve|copia|lee|revisa|hazme|haz|necesito que|ayudame a|manda|pon|mete|clasifica|ordena|etiqueta|agenda|escribe|genera|analiza|actualiza|cambia|guardalo|guarda|recuerda|llamame|enviar|crear|abrir|subir|descargar|mover|copiar|borrar|eliminar|organizar|etiquetar|clasificar|ordenar|volver a|vuelve a|hazlo otra vez|otra vez|repite|termina|continua|continuar|sigue con|saca|sacar|quita|quitar|intenta de nuevo|volver a intentar|rehaz|rehacer)\b/i;
const POLITE_ACTION_PATTERN = /\b(puedes|podrias|puedes ayudarme a|me ayudas a)\b.{0,80}\b(organizar|crear|enviar|mandar|pasar|compartir|adjuntar|buscar|descargar|subir|eliminar|borrar|abrir|programar|mover|copiar|leer|revisar|hacer|generar|analizar|actualizar|cambiar|guardar|recordar)\b/i;
const RESEARCH_PATTERN = /\b(investiga|investigar|averigua|averiguar|indaga|indagar|consulta|consultar|profundiza|profundizar)\b/i;

export function detectActionRequest(message: string): boolean {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return RESEARCH_PATTERN.test(normalized) || ACTION_PATTERN.test(normalized) || POLITE_ACTION_PATTERN.test(normalized);
}
