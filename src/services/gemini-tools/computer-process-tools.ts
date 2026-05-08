import { booleanProp, emptyParams, objectParams, stringArrayProp, stringProp } from './schema';
import type { GeminiFunctionDeclaration } from './types';

export const COMPUTER_PROCESS_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  { name: 'execute_command', description: 'Ejecuta un comando del sistema. Requiere confirmacion.', parameters: objectParams({ command: stringProp('Comando a ejecutar.') }, ['command']) },
  { name: 'open_application', description: 'Abre un archivo o aplicacion. Acepta ruta completa o nombre comun de la app y en Windows intenta resolver ejecutables instalados, accesos directos y alias del sistema.', parameters: objectParams({ path: stringProp('Ruta completa o nombre comun de la aplicacion o archivo.') }, ['path']) },
  { name: 'open_url', description: 'Abre una URL en el navegador predeterminado.', parameters: objectParams({ url: stringProp('URL completa, incluyendo https://.') }, ['url']) },
  { name: 'run_background_command', description: 'Ejecuta un comando oculto en segundo plano y devuelve session_id para seguimiento.', parameters: objectParams({ command: stringProp('Comando a ejecutar.'), working_directory: stringProp('Directorio de trabajo opcional.'), title: stringProp('Etiqueta corta opcional para la sesion.') }, ['command']) },
  { name: 'list_process_sessions', description: 'Lista las sesiones administradas por SofLIA y su estado.', parameters: emptyParams() },
  { name: 'poll_process_session', description: 'Consulta una sesion administrada por session_id y devuelve su salida reciente.', parameters: objectParams({ session_id: stringProp('ID de la sesion a consultar.') }, ['session_id']) },
  { name: 'kill_process_session', description: 'Termina una sesion administrada por SofLIA usando su session_id.', parameters: objectParams({ session_id: stringProp('ID de la sesion a terminar.') }, ['session_id']) },
  { name: 'get_background_host_status', description: 'Obtiene el estado del host en segundo plano de SofLIA.', parameters: emptyParams() },
  { name: 'repair_background_host', description: 'Reaplica la configuracion del host en segundo plano de SofLIA.', parameters: emptyParams() },
  { name: 'get_system_info', description: 'Obtiene informacion del sistema y rutas base del usuario.', parameters: emptyParams() },
  { name: 'clipboard_read', description: 'Lee el contenido del portapapeles.', parameters: emptyParams() },
  { name: 'clipboard_write', description: 'Escribe texto en el portapapeles.', parameters: objectParams({ text: stringProp('Texto a copiar.') }, ['text']) },
  { name: 'take_screenshot', description: 'Captura una imagen de la pantalla actual.', parameters: emptyParams() },
  { name: 'configure_email', description: 'Configura el email SMTP local del usuario.', parameters: objectParams({ email: stringProp('Direccion de email del usuario.'), password: stringProp('Contrasena de aplicacion.') }, ['email', 'password']) },
  { name: 'get_email_config', description: 'Verifica si el email SMTP local esta configurado.', parameters: emptyParams() },
  { name: 'send_email', description: 'Envia un email usando la configuracion SMTP local. Requiere confirmacion.', parameters: objectParams({ to: stringProp('Direccion de email del destinatario.'), subject: stringProp('Asunto del email.'), body: stringProp('Cuerpo del email.'), attachment_paths: stringArrayProp('Rutas completas de archivos a adjuntar.'), is_html: booleanProp('Si es true, el body se trata como HTML.') }, ['to', 'subject', 'body']) },
];
