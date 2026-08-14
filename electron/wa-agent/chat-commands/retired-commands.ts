/**
 * Comandos de flujos que se retiraron al unificar Flujos de Trabajo y Skills.
 *
 * No se borran en silencio: el usuario que los tenia aprendidos escribiria el
 * comando y recibiria "no conozco eso", que no le dice ni que cambio ni donde
 * esta ahora lo que buscaba. Cada respuesta lleva al sitio nuevo.
 *
 * Se retiran de aqui cuando dejen de escribirse, no antes.
 */
export const RETIRED_COMMAND_REPLIES: Readonly<Record<string, string>> = {
  '/flujos': 'Los flujos ahora son *skills*. Escribe */skills* para ver las que tienes disponibles aqui.',
  '/misflujos': 'Los flujos ahora son *skills*. Escribe */skills* para ver las que tienes disponibles aqui.',
  '/crearflujo': 'Ya no se crean flujos. Puedes crear tus propias skills desde Ajustes → Integraciones & Skills, y programar rutinas pidiendomelas ("cada dia a las 8 dame las noticias de IA").',
  '/usarflujo': 'Los flujos ahora son skills: invocalas por su comando. Escribe */skills* para verlas.',
  '/ejecutarflujo': 'Los flujos ahora son skills: invocalas por su comando. Escribe */skills* para verlas.',
  // Estos tres no tienen sustituto por chat a proposito: la bandeja de
  // aprobaciones vive en un solo sitio, y decidir sobre una reunion sin ver su
  // contenido era justo lo que hacia peligrosa la version por chat.
  '/pendientes': 'Las aprobaciones pendientes se revisan en el panel de *Reuniones* de la aplicacion, donde puedes ver el contenido antes de decidir.',
  '/aprobar': 'Las aprobaciones se hacen desde el panel de *Reuniones* de la aplicacion, con el detalle del caso a la vista.',
  '/autorizar': 'Las aprobaciones se hacen desde el panel de *Reuniones* de la aplicacion, con el detalle del caso a la vista.',
  '/rechazar': 'Los rechazos se hacen desde el panel de *Reuniones* de la aplicacion, con el detalle del caso a la vista.',
  '/noautorizar': 'Los rechazos se hacen desde el panel de *Reuniones* de la aplicacion, con el detalle del caso a la vista.',
};
