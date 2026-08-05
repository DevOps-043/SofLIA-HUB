/**
 * Etiquetas visibles del chip de herramienta activa en el chat.
 *
 * Cubre las familias declaradas en `src/services/gemini-tools/` mas las
 * herramientas sinteticas que el pipeline emite por su cuenta (investigacion
 * web, observacion del navegador). Cuando falta una entrada la UI cae al
 * nombre tecnico crudo, asi que toda herramienta nueva debe registrarse aqui;
 * `tool-display-names.test.ts` falla si alguna queda sin etiqueta.
 */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // Investigacion web y entregables
  web_research: 'Investigando en la web...',
  research_actions: 'Preparando entregables...',
  create_word_document: 'Creando documento Word...',
  generate_image: 'Generando imagen...',

  // Archivos y carpetas
  list_directory: 'Listando archivos...',
  list_directory_summary: 'Analizando la carpeta...',
  read_file: 'Leyendo archivo...',
  write_file: 'Escribiendo archivo...',
  create_directory: 'Creando carpeta...',
  move_item: 'Moviendo...',
  copy_item: 'Copiando...',
  delete_item: 'Eliminando...',
  get_file_info: 'Obteniendo info...',
  search_files: 'Buscando archivos...',
  organize_files: 'Organizando archivos...',
  batch_move_files: 'Moviendo archivos en lote...',
  undo_last_file_operation: 'Revirtiendo cambios...',

  // Sistema y procesos
  execute_command: 'Ejecutando comando...',
  open_application: 'Abriendo aplicación...',
  get_system_info: 'Info del sistema...',
  clipboard_read: 'Leyendo portapapeles...',
  clipboard_write: 'Copiando al portapapeles...',
  take_screenshot: 'Capturando pantalla...',
  use_computer: 'Usando computadora...',
  run_background_command: 'Ejecutando en segundo plano...',
  list_process_sessions: 'Revisando procesos...',
  poll_process_session: 'Consultando el proceso...',
  kill_process_session: 'Deteniendo el proceso...',
  get_background_host_status: 'Verificando el servicio...',
  repair_background_host: 'Reparando el servicio...',

  // Navegador
  open_url: 'Abriendo URL...',
  inspect_browser_view: 'Revisando la pestaña...',
  read_browser_dom: 'Leyendo la página...',
  navigate_integrated_browser: 'Navegando a la página...',
  browser_read_fallback: 'Consultando el navegador...',
  list_browser_profiles: 'Revisando perfiles del navegador...',
  reset_browser_profile: 'Reiniciando perfil del navegador...',

  // Correo propio (SMTP)
  get_email_config: 'Verificando email...',
  configure_email: 'Configurando email...',
  send_email: 'Enviando email...',

  // Gmail
  gmail_get_messages: 'Revisando el correo...',
  gmail_read_message: 'Leyendo el correo...',
  gmail_send: 'Enviando correo...',
  gmail_get_labels: 'Revisando etiquetas...',
  gmail_create_label: 'Creando etiqueta...',
  gmail_delete_label: 'Eliminando etiqueta...',
  gmail_modify_labels: 'Etiquetando el correo...',
  gmail_preview_organization: 'Planeando la organización...',
  gmail_apply_organization_plan: 'Organizando el correo...',
  gmail_undo_organization_plan: 'Revirtiendo la organización...',
  gmail_batch_empty_label: 'Vaciando la etiqueta...',
  gmail_empty_all_labels: 'Vaciando las etiquetas...',

  // Google Drive
  drive_list_files: 'Revisando Drive...',
  drive_search: 'Buscando en Drive...',
  drive_download: 'Descargando de Drive...',
  drive_upload: 'Subiendo a Drive...',
  drive_create_folder: 'Creando carpeta en Drive...',

  // Google Calendar
  google_calendar_get_events: 'Revisando la agenda...',
  google_calendar_create: 'Creando el evento...',
  google_calendar_delete: 'Eliminando el evento...',
  google_calendar_get_connections: 'Verificando calendarios...',

  // WhatsApp
  whatsapp_send_file: 'Enviando archivo por WhatsApp...',

  // IRIS (Project Hub)
  get_current_user_id: 'Identificando la sesión...',
  get_iris_teams: 'Revisando equipos de IRIS...',
  get_iris_team_members: 'Revisando integrantes...',
  get_iris_projects: 'Revisando proyectos de IRIS...',
  create_iris_project: 'Creando proyecto en IRIS...',
  delete_iris_project: 'Eliminando proyecto de IRIS...',
  create_iris_issue: 'Creando tarea en IRIS...',
  get_iris_statuses: 'Revisando estados...',
  get_iris_priorities: 'Revisando prioridades...',

  // Nodos remotos
  get_remote_node_host_status: 'Verificando el host remoto...',
  configure_remote_node_host: 'Configurando el host remoto...',
  list_remote_nodes: 'Revisando nodos remotos...',
  register_remote_node: 'Registrando el nodo remoto...',
  remove_remote_node: 'Eliminando el nodo remoto...',
  test_remote_node: 'Probando el nodo remoto...',
  open_application_on_node: 'Abriendo app en el nodo...',
  run_background_command_on_node: 'Ejecutando en el nodo...',
  take_screenshot_on_node: 'Capturando el nodo...',
  use_computer_on_node: 'Operando el nodo remoto...',
  list_remote_node_process_sessions: 'Revisando procesos del nodo...',
  poll_remote_node_process_session: 'Consultando el proceso remoto...',
  kill_remote_node_process_session: 'Deteniendo el proceso remoto...',
};
