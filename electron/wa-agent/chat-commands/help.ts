const HELP_LINES = [
  '*Comandos disponibles:*',
  '',
  '/status - Estado de SofLIA',
  '/reset - Reiniciar conversacion',
  '/new - Igual que /reset',
  '/perfil - Ver o editar mi personalizacion persistente',
  '/perfil nombre LIA - Cambiar como se llama el agente para ti',
  '/perfil tono emocional - Cambiar tono: profesional, cercano, emocional, directo',
  '/permisos - Ver o administrar permisos si eres numero maestro',
  '/correo - Revisar correo',
  '/correo hoy - Correos de hoy',
  '/correo noleidos - Correos pendientes',
  '/agenda - Preparar agenda de hoy',
  '/agenda 2026-03-22 - Preparar agenda de una fecha',
  '/seguimiento correo@empresa.com | tema | contexto - Borrador de seguimiento',
  '/reunion notas... - Crear caso de reunion desde notas',
  '/reunion prep 2026-03-22 - Preparar reunion',
  '/reunion drive | LINK | titulo - Crear caso desde Drive',
  '/driveproyecto Nombre | carpetaPadre | espacioChat - Crear espacio en Drive',
  '/chatdirectivo SPACE | contexto | tono - Actualizacion ejecutiva',
  '/computadora describe la accion - Preparar tarea en PC',
  '/flujos - Ver workflows, variantes y rutinas pasivas',
  '/pendientes - Ver casos pendientes',
  '/aprobar CASE_ID - Autorizar un caso',
  '/rechazar CASE_ID - Rechazar un caso',
  '/skills - Skills disponibles por WhatsApp',
  '/presentacion - Crea una presentacion ejecutiva y te la envio',
];

export function buildHelpText(isGroup: boolean): string {
  const activationLine = isGroup ? ['/activation mention|always - Modo de activacion en grupo'] : [];
  const footer = isGroup
    ? 'En grupos, solo respondo si me etiquetas (@SofLIA), usas el prefijo /soflia, o incluyes mi nombre "soflia" en tu mensaje.'
    : 'Tip: tambien puedes pedir cosas como "dame mis correos a las 8 am" o "prende las luces de mi cuarto a las 9 pm" y lo guardare como workflow pasivo.';

  return [...HELP_LINES, ...activationLine, '/help - Esta ayuda', '', footer].join('\n');
}
