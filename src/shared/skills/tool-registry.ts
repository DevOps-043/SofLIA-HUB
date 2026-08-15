/**
 * Registro presentable de herramientas.
 *
 * El catalogo runtime son ~90 declaraciones cuyos nombres son identificadores
 * internos (`gmail_get_messages`, `use_computer`). Pedirle al usuario que
 * configure sobre esa lista seria pedirle que elija a ciegas. Este modulo las
 * agrupa por dominio y les pone nombre y descripcion en su idioma.
 *
 * Modulo PURO: lo consumen igual el renderer (para pintar la pantalla) y main
 * (para resolver que concede en cada canal). Una sola fuente evita que la
 * pantalla ofrezca algo que el runtime luego no concede.
 *
 * Lo que NO esta aqui es tan deliberado como lo que esta:
 *  - `whatsapp_send_file` y las herramientas de nodos remotos: no son una
 *    decision "por Skill" sino de la superficie y del inventario de nodos.
 *    Ofrecerlas sugeriria un control que esta pantalla no tiene.
 *  - La busqueda web: no es una herramienta. Ver `SkillWebSearch`.
 */

export type SkillToolGroupId =
  | 'correo'
  | 'calendario'
  | 'drive'
  | 'chat'
  | 'navegador'
  | 'computadora'
  | 'archivos'
  | 'procesos'
  | 'proyectos'
  | 'imagenes'
  | 'espacio-trabajo';

export interface SkillToolEntry {
  /** Identificador del catalogo runtime. */
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /**
   * La ofrece un canal de mensajeria pero NO el catalogo del chat del Hub.
   * Se marca para que la interfaz lo diga en vez de presentarla como si
   * estuviera disponible en todas partes.
   */
  readonly channelOnly?: true;
  /**
   * Su efecto no se deshace desde el chat: sale de la organizacion, altera el
   * buzon o actua sobre el equipo. La interfaz lo senala para que el usuario
   * sepa que esta concediendo. NO implica que se ejecute sin confirmacion: las
   * confirmaciones viven en el ejecutor y no dependen de esta seleccion.
   */
  readonly irreversible?: boolean;
}

export interface SkillToolGroup {
  readonly id: SkillToolGroupId;
  readonly label: string;
  readonly description: string;
  readonly tools: readonly SkillToolEntry[];
}

export const SKILL_TOOL_GROUPS: readonly SkillToolGroup[] = Object.freeze([
  {
    id: 'correo',
    label: 'Correo',
    description: 'Leer, organizar y enviar correo de Gmail.',
    tools: [
      { name: 'gmail_get_messages', label: 'Listar correos', description: 'Busca mensajes en la bandeja con un filtro.' },
      { name: 'gmail_read_message', label: 'Leer un correo', description: 'Abre el contenido completo de un mensaje.' },
      { name: 'gmail_get_labels', label: 'Ver etiquetas', description: 'Consulta las etiquetas existentes.' },
      { name: 'gmail_preview_organization', label: 'Previsualizar organizacion', description: 'Propone un plan de orden sin tocar nada.' },
      { name: 'gmail_send', label: 'Enviar correo', description: 'Envia un mensaje. Sale de la organizacion.', irreversible: true },
      { name: 'gmail_modify_labels', label: 'Aplicar etiquetas', description: 'Cambia las etiquetas de un mensaje.', irreversible: true },
      { name: 'gmail_create_label', label: 'Crear etiqueta', description: 'Crea una etiqueta nueva.', irreversible: true },
      { name: 'gmail_delete_label', label: 'Borrar etiqueta', description: 'Elimina una etiqueta.', irreversible: true },
      { name: 'gmail_trash', label: 'Mover a la papelera', description: 'Envia mensajes a la papelera.', irreversible: true, channelOnly: true },
      { name: 'gmail_apply_organization_plan', label: 'Aplicar plan de organizacion', description: 'Ejecuta el plan previsualizado sobre el buzon.', irreversible: true },
      { name: 'gmail_undo_organization_plan', label: 'Deshacer plan', description: 'Revierte el ultimo plan aplicado.', irreversible: true },
      { name: 'gmail_batch_empty_label', label: 'Vaciar una etiqueta', description: 'Vacia todos los mensajes de una etiqueta.', irreversible: true },
      { name: 'gmail_empty_all_labels', label: 'Vaciar todas las etiquetas', description: 'Vacia el contenido de todas las etiquetas.', irreversible: true },
    ],
  },
  {
    id: 'calendario',
    label: 'Calendario',
    description: 'Consultar y modificar eventos de Google Calendar.',
    tools: [
      { name: 'google_calendar_get_events', label: 'Ver eventos', description: 'Consulta los eventos de un rango de fechas.' },
      { name: 'google_calendar_get_connections', label: 'Ver calendarios conectados', description: 'Lista las cuentas de calendario vinculadas.' },
      { name: 'google_calendar_create', label: 'Crear evento', description: 'Crea un evento, con invitados si se indican.', irreversible: true },
      { name: 'google_calendar_delete', label: 'Borrar evento', description: 'Elimina un evento del calendario.', irreversible: true },
    ],
  },
  {
    id: 'drive',
    label: 'Drive',
    description: 'Buscar y gestionar archivos de Google Drive.',
    tools: [
      { name: 'drive_list_files', label: 'Listar archivos', description: 'Lista el contenido de una carpeta.' },
      { name: 'drive_search', label: 'Buscar en Drive', description: 'Busca archivos por nombre o contenido.' },
      { name: 'drive_download', label: 'Descargar archivo', description: 'Trae un archivo para poder leerlo.' },
      { name: 'drive_upload', label: 'Subir archivo', description: 'Sube un archivo a Drive.', irreversible: true },
      { name: 'drive_create_folder', label: 'Crear carpeta', description: 'Crea una carpeta nueva.', irreversible: true },
    ],
  },
  {
    id: 'chat',
    label: 'Google Chat',
    description: 'Leer y publicar en espacios de Google Chat.',
    tools: [
      { name: 'gchat_list_spaces', channelOnly: true, label: 'Ver espacios', description: 'Lista los espacios disponibles.' },
      { name: 'gchat_get_messages', channelOnly: true, label: 'Leer mensajes', description: 'Consulta los mensajes de un espacio.' },
      { name: 'gchat_get_members', channelOnly: true, label: 'Ver miembros', description: 'Consulta quien pertenece a un espacio.' },
      { name: 'gchat_send_message', channelOnly: true, label: 'Publicar mensaje', description: 'Publica en un espacio. Lo ven todos sus miembros.', irreversible: true },
      { name: 'gchat_add_reaction', channelOnly: true, label: 'Reaccionar', description: 'Anade una reaccion a un mensaje.' },
    ],
  },
  {
    id: 'navegador',
    label: 'Navegador integrado',
    description: 'Leer y operar paginas en el navegador de la aplicacion.',
    tools: [
      { name: 'read_browser_dom', label: 'Leer la pagina', description: 'Extrae el contenido de la pagina abierta.' },
      { name: 'navigate_integrated_browser', label: 'Navegar', description: 'Abre una direccion en el navegador integrado.' },
      { name: 'click_browser_element', label: 'Hacer clic', description: 'Pulsa un elemento de la pagina.', irreversible: true },
      { name: 'type_in_browser_element', label: 'Escribir en la pagina', description: 'Escribe texto en un campo.', irreversible: true },
      { name: 'scroll_integrated_browser', label: 'Desplazar', description: 'Desplaza la pagina.' },
      { name: 'go_back_integrated_browser', label: 'Volver atras', description: 'Retrocede en el historial.' },
    ],
  },
  {
    id: 'computadora',
    label: 'Control de la computadora',
    description: 'Ver la pantalla y operar aplicaciones del equipo.',
    tools: [
      { name: 'use_computer', label: 'Usar la computadora', description: 'Observa la pantalla y opera aplicaciones. Actua sobre tu equipo.', irreversible: true },
      { name: 'take_screenshot', label: 'Capturar pantalla', description: 'Toma una captura del monitor activo.' },
      { name: 'open_application', label: 'Abrir aplicacion', description: 'Lanza una aplicacion instalada.' },
      { name: 'open_url', label: 'Abrir una direccion', description: 'Abre una direccion en el navegador del sistema.' },
      { name: 'get_system_info', label: 'Ver datos del sistema', description: 'Consulta informacion del equipo.' },
      { name: 'clipboard_read', label: 'Leer el portapapeles', description: 'Lee lo que hay copiado.' },
      { name: 'clipboard_write', label: 'Escribir el portapapeles', description: 'Sustituye el contenido copiado.', irreversible: true },
      { name: 'list_browser_profiles', label: 'Ver perfiles de navegador', description: 'Lista los perfiles disponibles.' },
    ],
  },
  {
    id: 'archivos',
    label: 'Archivos del equipo',
    description: 'Leer, escribir y organizar archivos locales.',
    tools: [
      { name: 'list_directory', label: 'Listar carpeta', description: 'Muestra el contenido de una carpeta.' },
      { name: 'list_directory_summary', label: 'Resumir carpeta', description: 'Resume el contenido de una carpeta grande.' },
      { name: 'read_file', label: 'Leer archivo', description: 'Lee un archivo, incluidos PDF y Office.' },
      { name: 'get_file_info', label: 'Ver datos de un archivo', description: 'Consulta tamano, fechas y tipo.' },
      { name: 'search_files', label: 'Buscar archivos', description: 'Busca archivos por nombre o contenido.' },
      { name: 'write_file', label: 'Escribir archivo', description: 'Crea o sobrescribe un archivo.', irreversible: true },
      { name: 'create_word_document', label: 'Crear documento Word', description: 'Genera un .docx con el contenido indicado.', irreversible: true },
      { name: 'create_directory', label: 'Crear carpeta', description: 'Crea una carpeta nueva.', irreversible: true },
      { name: 'move_item', label: 'Mover', description: 'Mueve un archivo o carpeta.', irreversible: true },
      { name: 'copy_item', label: 'Copiar', description: 'Copia un archivo o carpeta.', irreversible: true },
      { name: 'delete_item', label: 'Borrar', description: 'Elimina un archivo o carpeta.', irreversible: true },
      { name: 'organize_files', label: 'Organizar archivos', description: 'Reordena una carpeta segun un criterio.', irreversible: true },
      { name: 'batch_move_files', label: 'Mover en lote', description: 'Mueve varios archivos de una vez.', irreversible: true },
      { name: 'undo_last_file_operation', label: 'Deshacer', description: 'Revierte la ultima operacion de archivos.' },
    ],
  },
  {
    id: 'procesos',
    label: 'Procesos y correo local',
    description: 'Ejecutar comandos y usar la cuenta de correo configurada.',
    tools: [
      { name: 'execute_command', label: 'Ejecutar comando', description: 'Ejecuta un comando en el equipo.', irreversible: true },
      { name: 'run_background_command', label: 'Comando en segundo plano', description: 'Lanza un proceso persistente.', irreversible: true },
      { name: 'list_process_sessions', label: 'Ver procesos', description: 'Lista los procesos en segundo plano.' },
      { name: 'poll_process_session', label: 'Consultar un proceso', description: 'Lee la salida de un proceso activo.' },
      { name: 'kill_process_session', label: 'Terminar un proceso', description: 'Detiene un proceso en segundo plano.', irreversible: true },
      { name: 'get_background_host_status', label: 'Estado del host', description: 'Consulta el estado del host de procesos.' },
      { name: 'get_email_config', label: 'Ver correo configurado', description: 'Consulta la cuenta local configurada.' },
      { name: 'send_email', label: 'Enviar correo local', description: 'Envia desde la cuenta configurada.', irreversible: true },
    ],
  },
  {
    id: 'proyectos',
    label: 'Proyectos (IRIS)',
    description: 'Consultar y crear trabajo en el gestor de proyectos.',
    tools: [
      { name: 'get_iris_teams', label: 'Ver equipos', description: 'Lista los equipos.' },
      { name: 'get_iris_projects', label: 'Ver proyectos', description: 'Lista los proyectos.' },
      { name: 'get_iris_team_members', label: 'Ver miembros', description: 'Lista los miembros de un equipo.' },
      { name: 'get_iris_statuses', label: 'Ver estados', description: 'Consulta los estados disponibles.' },
      { name: 'get_iris_priorities', label: 'Ver prioridades', description: 'Consulta las prioridades disponibles.' },
      { name: 'get_current_user_id', label: 'Ver mi usuario', description: 'Identifica al usuario actual.' },
      { name: 'create_iris_project', label: 'Crear proyecto', description: 'Crea un proyecto nuevo.', irreversible: true },
      { name: 'create_iris_issue', label: 'Crear tarea', description: 'Crea una tarea o incidencia.', irreversible: true },
      { name: 'delete_iris_project', label: 'Borrar proyecto', description: 'Elimina un proyecto.', irreversible: true },
    ],
  },
  {
    id: 'imagenes',
    label: 'Imagenes',
    description: 'Generar imagenes para ilustrar la respuesta.',
    tools: [
      { name: 'generate_image', label: 'Generar imagen', description: 'Crea una imagen a partir de una descripcion.' },
    ],
  },
  {
    id: 'espacio-trabajo',
    label: 'Espacio de trabajo de la Skill',
    description: 'Escribir el entregable dentro del espacio aislado de la Skill.',
    tools: [
      { name: 'workspace_list_files', label: 'Listar', description: 'Lista los archivos del espacio.' },
      { name: 'workspace_read_file', label: 'Leer', description: 'Lee un archivo del espacio.' },
      { name: 'workspace_write_file', label: 'Escribir', description: 'Crea o sobrescribe dentro del espacio.' },
      { name: 'workspace_edit_file', label: 'Editar', description: 'Modifica un archivo del espacio.' },
      { name: 'workspace_generate_image', label: 'Generar imagen', description: 'Crea una imagen dentro del espacio.' },
      { name: 'workspace_download_image', label: 'Descargar imagen', description: 'Trae una imagen de una fuente al espacio.' },
    ],
  },
]);

/** Todas las entradas del registro, aplanadas. */
export const SKILL_TOOL_ENTRIES: readonly SkillToolEntry[] = Object.freeze(
  SKILL_TOOL_GROUPS.flatMap((group) => group.tools),
);

const ENTRY_BY_NAME: ReadonlyMap<string, SkillToolEntry> = new Map(
  SKILL_TOOL_ENTRIES.map((entry) => [entry.name, entry]),
);

export function findSkillTool(name: string): SkillToolEntry | null {
  return ENTRY_BY_NAME.get(name) ?? null;
}

/** Si el registro describe la herramienta y, por tanto, se puede presentar. */
export function isRegisteredSkillTool(name: string): boolean {
  return ENTRY_BY_NAME.has(name);
}

export function groupOfSkillTool(name: string): SkillToolGroup | null {
  return SKILL_TOOL_GROUPS.find((group) => group.tools.some((tool) => tool.name === name)) ?? null;
}

/**
 * Como se resuelve la busqueda web de una Skill.
 *
 * No es una herramienta y no puede serlo: en Gemini el grounding de Google
 * Search EXCLUYE las function declarations de la misma peticion. Presentarla
 * como una casilla mas haria creer que se combinan, y el usuario no entenderia
 * por que al marcarla dejan de funcionar las demas.
 */
export type SkillWebSearch = 'auto' | 'siempre' | 'nunca';

export const SKILL_WEB_SEARCH_OPTIONS: { value: SkillWebSearch; label: string; description: string }[] = [
  { value: 'auto', label: 'Automatica', description: 'SofLIA decide segun lo que le pidas. Es el comportamiento de siempre.' },
  { value: 'siempre', label: 'Siempre', description: 'Busca en la web en cada turno de esta skill.' },
  { value: 'nunca', label: 'Nunca', description: 'No busca en la web aunque le pidas algo reciente.' },
];

export function isSkillWebSearch(value: unknown): value is SkillWebSearch {
  return value === 'auto' || value === 'siempre' || value === 'nunca';
}
