# IPC e integraciones externas

Estado: vigente. Actualizado: 2026-10-22.

<!-- evidence: electron/preload/channels.ts -->
<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/service-ipc.ts -->

## Calendario

El calendario conserva sus canales y argumentos posicionales. El contrato
compartido está en [calendar.ts](../../src/shared/calendar.ts); main valida
schemas cerrados y exige sesión y marco principal de Hub u Orbe registrados.
Crear/actualizar/eliminar pide confirmación nativa con cancelar por defecto;
el contexto se revalida antes de la petición del proveedor, después de esperas.
Logout/login, navegación, cambio de ventana/marco o conexión invalidan la
aprobación. Sólo hay un diálogo activo y vence a los 120 segundos; si el diálogo
sigue abierto tras vencer, la respuesta tardía no ejecuta nada y no se abre otro.
OAuth tampoco persiste una conexión si cambia la sesión antes de guardarla.

Las entradas de creación usan título y fechas ISO con zona; actualización
requiere ambos extremos si cambia el intervalo. Fechas viajan como ISO en DTO y
se convierten en Date dentro del servicio. get-events conserva el sobre
success/events/error; [el wrapper](../../src/services/calendar.ts) lo desenvuelve
para chat y panel. Conexiones/status conservan sus respuestas de lectura; al
rechazar esas consultas la promesa falla con un error genérico. Los eventos se
proyectan a campos públicos; renovación sólo reenvía proveedor. No se exponen
tokens, conexiones internas ni errores del proveedor.

La [custodia privada](../../electron/calendar/credential-store.ts) usa safeStorage
asíncrono del SO y archivos `calendar-credentials/<hash del userId>.bin`. Dentro
del cifrado se validan versión, propietario exacto y conexiones; no hay fallback
plano y Linux rechaza basic_text/unknown. loadConnections/saveConnections son
asíncronos; conectar/desconectar no publica éxito antes de persistir.

Al cambiar la sesión de main se vacían conexiones, polling y estado de trabajo.
Las revisiones invalidan A/B/A y las guardas de conexión bloquean OAuth,
restauración, renovación y consultas obsoletas. El cliente OAuth compartido con
Gmail/Drive/Chat valida también su transporte antes de solicitudes y al recibir
respuestas, incluso si el consumidor conserva una referencia anterior. Una
petición remota ya enviada puede haber producido efectos y no se revierte.

El JSON heredado calendar-connections.json se reemplaza atómicamente por un
archivo cifrado con cabecera versionada, conservando todos sus registros. Sólo
se importan conexiones con userId coincidente; las huérfanas requieren OAuth de
nuevo. Un archivo privado existente, incluso vacío o ilegible, impide reimportar
desde el legado. Errores de cifrado/escritura conservan la versión anterior.
No se agregan canales ni herramientas de desarrollo al runtime.

## Envío Gmail

`gmail:send` conserva canal y parámetros, con [DTO/schema compartido](../../src/shared/gmail-delivery.ts).
El handler verifica sesión, ventana Hub/Orbe registrada, marco principal y documento
propio mediante la [guarda IPC común](../../electron/ipc/caller-authorization.ts),
también utilizada por calendario. El servicio fija propietario, revisión y conexión
Google antes de esperar. El usuario confirma cuenta, destinatarios, asunto, cuerpo
y rutas canónicas/tamaños de los adjuntos en un diálogo nativo; cancelar es la
opción predeterminada y la aprobación vence a los 120 segundos.

La [preparación](../../electron/gmail/attachments.ts) sólo acepta archivos regulares
locales absolutos, rechaza enlaces finales/dispositivos/UNC y comprueba identidad
y metadata durante lectura incremental. Todos los archivos se capturan antes de
confirmar: un fallo impide todo envío y después de aprobar se transmite esa copia
sin releer rutas. El compositor MIME existente se reutiliza con acceso propio a
URLs/archivos deshabilitado, nombres Unicode y BCC conservado en el raw de Gmail.

Política del Hub: máximo 20 destinatarios entre Para/CC/CCO, 300 caracteres de
asunto, 200000 de cuerpo, 10 adjuntos, 10 MiB por archivo, 20 MiB acumulados y
30 MiB de MIME. Un nombre con correo representa un único buzón; no se admiten
listas/grupos escondidos dentro de una cadena. Éstas son cuotas locales, no un
compromiso de límites del proveedor.

`success:true` exige identificador del proveedor y contexto vigente. Cancelación
devuelve `cancelled:true`. Tras iniciar transporte, un fallo, respuesta sin ID o
cambio de contexto devuelve `uncertain:true`: revisar Enviados antes de repetir.
No hay retry automático ni rollback de un mensaje ya aceptado. Resultados/logs no
incluyen errores crudos, rutas ni contenido privado. Los planes y las operaciones
directas del buzón tienen sus propios controles descritos a continuación.

## Planes de organización de Gmail

<!-- evidence: electron/gmail/plan-handlers.ts -->
<!-- evidence: electron/gmail/plan-context.ts -->
<!-- evidence: src/shared/gmail-organization.ts -->

`gmail:preview-organization`, `gmail:apply-organization-plan` y
`gmail:undo-organization-plan` conservan servicio, handler, preload allowlisted y
wrapper tipado. Admiten únicamente el frame principal autenticado del Hub/Orbe.
Opciones cerradas e ID UUID se validan en main; el servicio captura usuario,
revisión y conexión Google y conserva un cliente durante toda la operación.
Aplicar/revertir exige confirmación nativa con cuenta, plan y alcance. Navegar,
cerrar o cambiar sesión cancela la confirmación y propaga una señal al SDK.

La vista previa guarda sólo grupos, etiquetas e IDs necesarios para revertir;
los ejemplos de remitentes/asuntos se devuelven sin persistirse en el plan. El
store cifrado valida propietario e ID internos y mantiene exclusión por cuenta
en el proceso. No importa los JSON globales heredados. Antes de cada efecto
remoto guarda una intención y después registra la confirmación y sus conteos.
Un resultado parcial conserva lo confirmado; una intención pendiente requiere
revisión manual y bloquea replay. Repetir un plan completado devuelve su resumen
guardado sin volver a mutar Gmail.

Revertir comprueba el conjunto actual completo de etiquetas de cada mensaje,
detiene el proceso ante diferencias y conserva etiquetas creadas que tengan
mensajes nuevos. Puede continuar una reversión interrumpida sin intención
pendiente, omitiendo mensajes ya confirmados. No hay transacción disco/Gmail ni
CAS remoto: persiste una ventana de carrera con cambios externos. Consultar
[cuotas](runtime-parameters.md#planes-de-organización-gmail) y
[recuperación](../operations/configuration.md#planes-privados-de-gmail).

## Operaciones directas del buzón Gmail

<!-- evidence: electron/gmail/mailbox-handlers.ts -->
<!-- evidence: electron/gmail/execution-context.ts -->
<!-- evidence: src/shared/gmail-mailbox.ts -->

Las nueve rutas restantes del registro Gmail validan caller, documento y entrada:
get-messages/get-message/get-labels son lecturas; modify-labels/trash/create-label/
delete-label/batch-modify-by-label/empty-and-delete-all-labels son mutaciones.
Antes de producir efectos, las seis mutaciones exigen confirmación nativa de
cuenta y alcance. Crear una etiqueta que ya existe devuelve su referencia sin
mutar ni pedir aprobación nueva. Sus opciones
y resultados se comparten entre servicio, preload y wrapper; no hay canales
nuevos. El contexto de ejecución se comparte con planes y conserva un cliente,
owner, revisión y conexión; las mutaciones comparten la exclusión por cuenta.
Las guardas runtime previas siguen siendo responsabilidad de su superficie.

Se resuelven todas las referencias antes de crear etiquetas; quitar una
desconocida, una referencia ambigua o añadir/quitar la misma etiqueta se rechaza.
Crear por nombre no confunde un nombre nuevo con el ID de otra etiqueta. El
borrado sólo admite etiquetas de usuario verificadas en la cuenta. Una etiqueta
de sistema puede ser origen de un lote de mensajes con opciones coherentes,
como quitar INBOX para archivar, conservando la etiqueta. Las lecturas
no devuelven detalles incompletos ni contenido de una sesión invalidada.

Los lotes preparan todas las páginas antes de mutar. Cada ID se procesa una vez
aunque se conserve la etiqueta origen; duplicados, ciclos o exceso de cuota
rechazan la preparación completa. El alcance aprobado queda fijo: mensajes
nuevos no se incorporan. El borrado posterior al vaciado comprueba que la
etiqueta esté vacía; si no, informa conflicto y la conserva. La limpieza total
se detiene al primer fallo y no anuncia éxito con errores.

`processed` y los conteos de limpieza conservan confirmaciones anteriores a un
fallo. `effectsConfirmed` cuenta solicitudes de escritura confirmadas, no
mensajes; `operationId` permite correlacionar fallos sin contenido privado.
`remaining` sólo vale cero si se verificó vacío; indefinido significa conteo
desconocido. `sourceEmpty` informa vacío/no vacío sin inventar cardinalidad.
En limpieza, `totalMessagesMovedToInbox` cuenta membresías por etiqueta: un
mensaje con dos etiquetas puede contarse dos veces. `remainingLabelsVerified`
distingue consulta final de una lista conservadora de etiquetas aún no borradas.

El progreso directo vive en memoria durante la llamada; no es el diario durable
de planes. Tras un fallo parcial/incierto se requiere revisar Gmail antes de
repetir, sin retry ni rollback automáticos. Persisten carreras externas entre
consulta y escritura; no se promete CAS ni transacción. Ver
[operación](../operations/configuration.md#operaciones-directas-de-gmail) y
[parámetros](runtime-parameters.md#operaciones-directas-de-gmail).

## Contrato IPC

El acompañamiento del orbe expone seis canales específicos de consulta, control,
señalización, práctica y estado, con autenticación y validación del frame principal
de Hub/Orbe. Main localiza objetivos; el renderer no recibe una API genérica para
mover ventanas o inyectar entrada. Ver [contrato y comportamiento](autonomous-orb-guidance.md).

El navegador integrado conecta Learning, Engine y Project Hub mediante un
canje de sesión desde main en la partición del usuario. El canal
`integrated-browser:ecosystem-connect` permite volver explícitamente a la
cuenta de Soflia Hub; exige frame principal autenticado y cero argumentos.
El renderer no recibe credenciales. El registro por perfil conserva la elección
de cuenta y el logout. Ver [diseño](../../openspec/changes/connect-browser-ecosystem-session/design.md)
y [activación](../../openspec/changes/connect-browser-ecosystem-session/integration.md).

<!-- evidence: electron/integrated-browser/ecosystem-session-runtime.ts -->
<!-- evidence: electron/preload/integrated-browser-api.ts -->

`computer:confirm-action` conserva el canal allowlisted y acepta un mensaje de
hasta 8000 caracteres con opciones `{ allowAlways?: boolean, command?: string }`; devuelve
`{ confirmed: boolean, always?: boolean }`. El wrapper tipado del renderer
guarda la aprobación exacta por usuario sólo tras una decisión humana. El fallback
nativo verifica sesión, mensaje/opciones y ventana emisora; sin ventana deniega.
La casilla Siempre permitir sólo aparece para comandos no sensibles vinculados
al detalle mostrado (la carpeta aparece aparte) y confirmar
con la casilla marcada es necesario para devolver `always: true`. No reemplaza
la política de ejecución main. Ver [permisos del chat](runtime-agents-manual.md#211-permisos-locales-de-comandos-y-archivos).

El namespace `agent-activity` expone `snapshot`, `publish` y el evento `changed`.
Sólo los frames principales autenticados del Hub y Orbe pueden acceder al
contrato. Main comprueba identidad, secuencia y un esquema cerrado de roles/estados,
sin texto privado. El renderer muestra una ventana flotante dentro del Hub y
combina el progreso local del chat con los avisos de main; no existe una ventana
auxiliar ni un canal para controlarla.
Ver [monitor de equipos](runtime-multiagent-harness.md#monitor-de-equipos).

El namespace `agent-runtime` incorpora context, release, state, start, cancel,
recover, publish, configure-codex, codex-key y el evento changed. Son operaciones
cerradas de la ventana y frame principal; no existe proxy RPC, shell o filesystem.
Contratos en [tipos compartidos](../../src/shared/agent-runtime.ts), handlers en
[main](../../electron/agent-runtime/handlers.ts) y [guía](runtime-multiagent-harness.md).

<!-- evidence: electron/agent-runtime/handlers.ts -->

Tres operaciones cerradas añadidas:

- `orb:browser-command`: una acción literal para cambiar pestaña o supervisar
  tarea. Exige la Orbe actual autenticada, visible y su marco principal;
  reanudar requiere confirmación nativa y recibo de tarea previo al diálogo.
  No devuelve URL, títulos ni DOM y no crea otro agente.
- `integrated-browser:semantic-memory`: status/enable/disable/rebuild/search/
  cancel y recibo de perfil. Main confirma opt-in/borrado, no acepta vectores,
  rutas, claves ni aprobaciones renderer. Devuelve estado y fuentes, no secretos.
- `integrated-browser:credential-session`: status/unlock/lock y recibo de
  perfil. Windows verifica; sólo devuelve éxito/estado de bloqueo/error saneado.
  No acepta PIN, `approved`, identificadores del SO ni rutas.

Los tres revalidan emisor/contexto tras esperas y detectan logout/login del mismo
titular. `credentialUnlocked` y `sensitiveHandoff` viajan en estado ya existente;
no añaden canales para leer secretos ni para ignorar la barrera sensible.

`integrated-browser:agent-shortcuts` acepta únicamente `list`, `save` o `remove`
con `profileRevision`; las mutaciones incluyen revisión de biblioteca, y datos
de entrada cerrados. Exige sesión y marco principal, no recibe rutas ni una
aprobación fabricada del renderer. El servicio comprueba capacidad, política,
perfil y control humano; el borrado pregunta en main. Responde con biblioteca
versionada, cancelación o error saneado. No existe IPC de ejecución de atajos.

La allowlist actual contiene 495 canales derivados de cinco arrays: 84, 52, 61, 159, 139. El numero es verificable en `electron/preload/channel-group-*.ts`; si cambia,
el catalogo y su validador deben actualizarse juntos.

| Namespace | Canales | Proposito |
|---|---:|---|
| `computer` | 33 | archivos, comandos, procesos, portapapeles, email, tema/sidebar |
| `desktop-agent` | 23 | tareas, abort, config, UI input, ventanas, screenshot, calibracion |
| `calendar` | 17 | OAuth, conexiones, eventos, polling y eventos de trabajo |
| `memory` | 14 | contexto, facts y skills |
| `orb` | 19 | dictado, TTS, apertura, comandos humanos del navegador y ventana flotante |
| `monitoring`, `gmail`, `remote-node` | 13 cada uno | actividad; correo; host remoto |
| `meeting`, `whatsapp` | 12 cada uno | runs/approvals/sync; conexion/config/status |
| `meeting-live` | 11 | audio, segmentos, deteccion y estado live |
| `channels` | 10 | hub multicanal (WhatsApp y Telegram) |
| `passive-skills` | 3 | consulta, alta y baja de Skills pasivas |
| `integrated-browser` | 124 | navegación, pestañas, grupos, sesión, perfiles, descargas, herramientas de página, marcadores, historial, credenciales, privacidad, política, supervisión, memoria semántica, atajos y bitácora del agente, sync, recuperación, diagnóstico, catálogo/extensiones por sitio y eventos |
| `desktop-context` | 2 | inventario de ventanas abiertas y extraccion en cascada del contenido de las que el usuario marca en el chat |
| `skill-workspace` | 14 | espacio de trabajo de Skills: crear, estado, leer, escribir, editar, borrar, guardar y descargar imagenes, abrir carpeta, progreso y URL de vista previa |
| `presentation`, `presentation-view` | 5 | vista a pantalla completa, exportacion a HTML autocontenido y preparacion de la identidad de marca |
| `project-hub` | 23 | proyectos, tareas y seguimiento |
| otros | 68 | voice, updater, automation, drive, pytools, telegram, gchat, app, auth, background-host, root, AI y learning-live |

### Recorrido obligatorio

`learning-live:open` recibe solo `organization_slug` y `session_id`. Main
valida la identidad SOFIA, consulta Learning en el origen configurado y abre
la URL Zoom autorizada en una pestaña sensible. Devuelve éxito, título o error
controlado; la URL y los tokens no cruzan este canal hacia el renderer.
`app:get-pending-learning-session` permite recuperar la referencia sin consumirla
durante login y `app:learning-session` anuncia solicitudes recibidas en caliente.
El contrato y los pasos de despliegue están en
[la integración Learning](../../openspec/changes/launch-learning-live-sessions/integration.md).

<!-- evidence: electron/learning-live-handlers.ts -->
<!-- evidence: electron/preload/learning-live-api.ts -->
<!-- evidence: src/services/learning-live-service.ts -->

`updater:install-update` conserva su canal y contrato `{ success, error? }`.
Ahora exige `WebContents` y frame principal de la ventana main, espera el
preflight de guardado y sólo entonces acepta la solicitud de instalación.
Errores/cancelaciones se devuelven saneados; el wrapper renderer los convierte
en error visible. El permiso de omitir guardado sólo existe en el diálogo
nativo: no se expone un canal de bypass ni control de `commitShutdown`.

1. El renderer llama un wrapper de `src/services` o una API `window.*` tipada.
2. `electron/preload/*-apis.ts` usa `safeInvoke`, `safeSend` o `safeOn`.
3. `safe-ipc.ts` valida canal y sanitiza cada argumento.
4. Un `*-handlers.ts` registra `ipcMain.handle/on`, valida el payload y llama al
   servicio de dominio.
5. El handler devuelve un objeto serializable; nunca retorna clases Electron,
   callbacks, streams vivos o tokens.

Agregar solo una cadena al array no implementa una capacidad. Un cambio IPC debe
actualizar las cuatro capas, tipos y pruebas segun
[el estandar](../standards/electron-ipc.md).

## Seguridad preload

- Canal desconocido: error `Unauthorized IPC channel` antes de invocar.
- Funciones/callbacks en payload: rechazo.
- Claves de prototype pollution: descartadas.
- Limites: profundidad 20, array 1000, objeto 200 claves.
- CSP se inyecta desde `electron/preload/security.ts`.
- Las ventanas principal y orbe usan sandbox, context isolation y Node off.
- El contenido del navegador integrado usa otra `WebContentsView` sin preload,
  con sandbox, context isolation, Node off y particion persistente propia. Sus
  canales solo existen en el renderer principal y el handler verifica el emisor.

### Contrato del navegador integrado

El evento existente `integrated-browser:state-changed` y las respuestas de
estado incluyen `tabs[].navigationSafety` opcional: acción `allow/warn/block`,
fuente `local/remote/degraded`, motivo controlado y fecha de revisión. No incluye
URLs adicionales, contenido remoto ni aprobación de bypass. Main conserva la
asociación interna con el documento; renderer muestra sólo el aviso de la
pestaña activa. No hay canales nuevos ni cambios de allowlist para esta capacidad.

`integrated-browser:runtime-diagnostic-export` no acepta argumentos ni permite
elegir rutas, datos o aprobación desde renderer. Exige el emisor/frame principal
y sesión; el servicio rechaza además perfil anónimo, transiciones y cierre.
`BrowserDiagnosticExporter` en `electron/integrated-browser/diagnostic-report.ts`
proyecta una instantánea sin datos navegados, obtiene confirmación y destino con
diálogos nativos y publica un JSON nuevo sin sobrescribir. Devuelve solamente
`diagnosticExport: { cancelled, exported }`; errores de E/S y diálogos tienen
mensajes controlados. No hay API runtime de agente, subida ni selector de otro
perfil. El guard central conserva su política de autenticación del producto.

`integrated-browser:bookmarks-import-html` conserva su canal sin argumentos.
Exige sesión autenticada, emisor autorizado y frame principal de la ventana
main; rechaza rutas u opciones enviadas por el renderer. Selección, lectura
acotada, revisión de conflictos y confirmación ocurren en main mediante
`electron/integrated-browser/bookmark-importer.ts`. No se expone un canal de
commit ni el plan de importación. La respuesta `bookmarkTransfer` sólo añade
conteos de actualizados, duplicados e inválidos a cancelación/importados/omitidos;
el wrapper tipado y la UI muestran ese resumen. Los errores imprevistos del
importador se sustituyen por mensajes públicos sin contenido ni rutas.

`integrated-browser:credentials-import/export` tampoco acepta argumentos.
Exigen sesión autenticada, emisor y frame principal; los diálogos de selección,
advertencia y destino se ejecutan en main. La exportación usa un archivo nuevo
de hasta 5 MiB y la importación prepara conflictos antes de escribir. El
renderer recibe sólo `{ cancelled, imported, updated, skipped, exported }`;
ninguna contraseña, ruta seleccionada o contenido del archivo cruza IPC.

`integrated-browser:tab-reorder` reordena las pestañas al arrastrarlas. El
handler y el método de preload ya existían, pero el canal **faltaba en la
allowlist**: `validateChannel` lanza de forma síncrona, y como la llamada vivía
dentro de un updater de estado de React, el error se propagaba por la fase de
render y dejaba la aplicación en blanco. El arrastre usa Pointer Events con
captura —el gesto no se pierde al salir de la pestaña ni compite con la región
de arrastre de la ventana— y el reordenamiento se calcula fuera del updater.

`electron/integrated-browser-handlers.ts` registra 114 operaciones invocables.

`integrated-browser:policy-recover` recibe sólo `store` (permissions/privacy/agent/shortcuts/semantic/history/audit)
y `profileRevision` entero no negativo. Handler y servicio verifican emisor,
marco principal, titular autenticado, perfil, ventana y control humano, también
tras esperas. Main prepara una recuperación restrictiva con confirmación nativa,
cancelar por omisión y revisión de cinco minutos. Devuelve sólo éxito/cancelación,
conteo restaurado o error saneado. No admite paths, claves, sync, otro perfil ni
un canal de commit separado; no es herramienta del agente runtime.
Contrato: `src/shared/browser-policy-recovery.ts`.

`shortcuts` exige además gobierno del agente permitido y devuelve conteo de
instrucciones, nunca las ejecuta. `integrated-browser:sync-control` añade
`{ action: 'recover-settings' }` sin argumentos extra, aprobación ni paths.
Usa la misma exclusión/cancelación del controlador y una confirmación nativa;
el resultado queda sin categorías activas. Los literales de acción/elección
deben ser strings, no arrays que se conviertan implícitamente a strings.
No añade canales ni primitivas accesibles al runtime.

`history` requiere `advancedHistory` y recupera registros/FTS bajo la retención
vigente; `audit` requiere `agentGovernance` y recupera eventos cifrados sin
ejecutar acciones. El conteo de SQLite se recalcula al confirmar, por si venció
retención durante el diálogo. Borrados y cambios de retención invalidan las
copias anteriores antes de modificar datos.

`sync-control` también admite `{ action: 'recover-state' }` y
`{ action: 'rollback-state' }`, sin payload adicional. La primera archiva
checkpoints/conflictos dañados o incoherentes y pausa transferencia para volver
a comparar datos actuales. La segunda revierte los tres archivos locales de
una recuperación incompleta; puede devolver el daño original. Ambas requieren
HITL nativo y guardas del controlador. Un marcador pendiente impide nuevas
operaciones, incluso después de reiniciar. No contactan Auth/servidor ni
restauran claves, identidades de dispositivos o aprobaciones antiguas.

`integrated-browser:extensions-catalog` admite sólo `list` o `prepare` con
`catalogId` y `updateInstallId` opcional. Devuelve catálogo público o revisión
con token, nunca rutas de carpetas ni aprobación. Selección de carpeta nativa;
confirmación por el canal de instalación existente. Valida marco principal,
titular del perfil, sesión/ventana/control y política empresarial. Una actualización
exige extensión deshabilitada y páginas en blanco; mantiene esas guardas hasta
publicar. Contrato en `src/shared/browser-extension-catalog.ts`.

`integrated-browser:extensions-restrict-sites` recibe únicamente
`{ installId, sites }`, hasta 50 sitios de 300 caracteres. Valida emisor main,
sesión sin cambios y marco principal; main exige perfil persistente autenticado,
control humano, extensión deshabilitada y ausencia de páginas vivas no blancas.
Devuelve metadata actualizada, sin ruta ni hash interno; fallos no filtran E/S.
Preload y wrapper tipado exponen `restrictExtensionSites`. Sólo reduce
permisos y no reinstala ni actualiza código.
Passkeys no añaden IPC: su selector devuelve la elección al callback nativo.

`integrated-browser:agent-control` recibe un DTO cerrado con acción
`pause/resume/stop/take-control`, ID CU y revisiones de perfil/ejecución. Exige
sesión y marco principal. Main rechaza reanudación/pausa obsoletas; detener sólo
reduce autoridad sobre la misma tarea/perfil y no necesita revisión de ejecución
vigente. `state-changed` publica `agentTask` efímero e IDs de avisos de política
vigentes; un acuse no significa que terminó una operación nativa. El renderer
retira avisos cancelados y descarta acuses de otro contexto. No hay primitivas
de entrada ni funciones del supervisor disponibles para páginas o runtime.
Los otros diez canales entregan eventos, incluidos cambios de estado,
descargas y solicitudes de permiso. `electron/preload/integrated-browser-api.ts`
y `src/services/integrated-browser-service.ts` son las capas públicas.
`history-retention-get/set` leen y configuran retención del perfil; `set` sólo
admite `days: null | 30 | 90 | 180 | 365`, después de confirmación explícita en
renderer. Las políticas administradas prevalecen. `tabs-recently-closed`
devuelve hasta 25 entradas de sesión; `tab-reopen-closed` acepta opcionalmente
`tabId` para reabrir una entrada elegida. Sin argumento conserva el atajo de
reabrir la última. Ninguna ruta acepta un emisor distinto del renderer principal.
Las capacidades y sus límites están en
[la plataforma del navegador](integrated-browser-platform.md).
La operación de scroll espera la autorización antes de responder; una
denegación retorna error y no se convierte en éxito anticipado.
La captura local de respaldo para menús no es una captura para el agente.

`integrated-browser:document-read` agrega una lectura de solo consulta para el
chat. El servicio toma la pestaña activa visible, reutiliza la extracción
semántica del modo lectura y vuelve a comprobar pestaña, `WebContents` y URL al
terminar; si cualquiera cambió, descarta el resultado. El preload solo expone
`readActiveDocument()` al renderer principal y la herramienta
`read_active_document` pagina el texto en fragmentos acotados, marcados como
contenido no confiable. Este canal no navega, no escribe y no activa la síntesis
de voz ni la cápsula del modo lectura.

Esas acciones tienen dos entradas equivalentes: el menu contextual
(`electron/integrated-browser/context-menu.ts`) y un menu flotante que aparece
junto al texto al terminar la seleccion
(`electron/integrated-browser/selection-menu.ts`). El menu flotante se inyecta
en cada marco de la pagina —no en el renderer— porque la vista del navegador es
una `WebContentsView` nativa que se pinta encima de la interfaz de React;
dibujarlo en el renderer lo dejaria tapado y sin poder seguir a la seleccion al
desplazar. Sus pulsaciones vuelven a main por `console-message`, el mismo canal
que ya usa el vigia de seleccion, y main solo acepta las acciones publicadas por
el propio menu: la pagina es contenido no confiable y ninguna accion envia el
turno por su cuenta. El menu se apaga mientras el agente conduce el navegador.

"Mejorar la redaccion" es la excepcion: no viaja al chat. Abre un panel en la
propia pagina (`electron/integrated-browser/writing-panel.ts`) donde el usuario
escribe que quiere cambiar, ve la propuesta y la deja caer en su campo de texto
sin copiar ni pegar. El circuito tiene tres tramos: la pagina avisa por consola
que hay una peticion; main la **lee** con `executeJavaScript` —el texto del
usuario nunca viaja por la consola— y la sube por
`integrated-browser:writing-request`; el renderer resuelve con el modelo
(`src/services/browser-writing.ts`, donde estan la clave y el modelo del
producto) y devuelve por `integrated-browser:writing-resolve`, que main inyecta
de vuelta en el panel. Escribir en el campo se hace con `insertText`, lo unico
que conserva el deshacer del navegador y avisa a la aplicacion de la pagina;
si el fragmento de origen no era editable, la propuesta entra en el compositor
visible. El panel se cierra cuando el agente toma el control.

El modo lectura usa `integrated-browser:reading-prepare`,
`integrated-browser:reading-synthesize`, `integrated-browser:reading-highlight`,
`integrated-browser:reading-cancel`, `integrated-browser:reading-close`, además de
`integrated-browser:reading-toolbar-wait` y
`integrated-browser:reading-toolbar-sync`. Main extrae texto semántico de la
pestaña activa, excluye formularios y contenido editable y, para Google Docs,
prioriza la selección explícita, la exportación autenticada mediante la misma
`Session` de Electron y el árbol de accesibilidad temporal de Chromium. Si esas
vías no entregan el documento, falla sin usar el DOM de menús como respaldo.
Main conserva la clave de
ElevenLabs fuera del renderer y entrega únicamente audio, offsets y marcas de
tiempo. El resaltado acepta sólo un `readingId` y offsets enteros validados,
comprueba sesión/URL y aplica un CSS Highlight temporal sin mutar nodos. La
reproducción de Google Docs omite el CSS Highlight porque su lienzo virtual no
ofrece rangos DOM estables; así nunca subraya etiquetas de la interfaz por una
coincidencia textual. En su lugar, el mismo canal de resaltado actualiza un
token subrayado en la cápsula con los offsets originales. La cápsula se inyecta en un
`ShadowRoot` efímero de la página y entrega acciones mediante una espera IPC
cancelable; no consulta el DOM por polling ni modifica el viewport. Su asa usa
Pointer Events locales para moverla y limitarla al área visible, sin abrir un
canal IPC adicional ni persistir coordenadas. La síntesis divide el contenido en
un microlote inicial y lotes anticipados acotados; una espera lenta se aborta y
no dispara reintentos automáticos. Antes de cada solicitud, main prepara aliases
como `SofLIA` → “Soflía” y decimales como `5.12` → “cinco punto doce”,
declara `language_code` y envía contexto vecino acotado. Un mapa de fronteras
traduce los timestamps de ese texto hablado al contenido original.

`orb:synthesize` comparte la misma configuración main-only de ElevenLabs,
acepta únicamente texto acotado desde la ventana principal o la Orbe
autenticadas y devuelve MP3 Base64 con `mimeType`, `voiceId` y `modelId`. La
reproducción decodifica MP3 mediante Web Audio para conservar la cola y el nodo
que anima la Orbe; ninguna credencial cruza IPC.

Los payloads de URL admiten HTTP(S), `about:blank` y busqueda normalizada; los
bounds son enteros y se ajustan al contenido de la ventana. Un emisor distinto
del renderer principal recibe `sender_denied`. El renderer nunca recibe el
secreto descifrado ni una ruta de extension; esas operaciones se resuelven en
main y no forman parte del catalogo de herramientas del agente. La instalacion
separa inspeccion y confirmacion: main emite metadata y un token efimero, y solo
copia o carga al recibir la confirmacion renderer. La captura de
solo lectura exige un viewport visible. La percepción pasiva conserva una
captura visual reducida a 1024 px en su lado mayor y codificada en JPEG. Una
navegación o interacción programa una captura después de la ventana de calma,
pero la captura terminada no vuelve a programarse por sí sola: en reposo no hay
polling del compositor. La ventana mínima es de diez segundos y la calma de
cuatro; en YouTube son treinta y doce para dejar terminar transcripciones y
paneles asíncronos. Solo un turno clasificado como dependiente del navegador
obtiene una revisión vigente y el
DOM saneado bajo demanda. Solo el último snapshot queda en memoria, Computer Use
no compite con el temporizador pasivo y el refresco nunca invoca al modelo.
Los permisos de sitio se consultan y cambian con los canales
`integrated-browser:site-permissions-*`. Cuando una solicitud necesita HITL,
main publica `integrated-browser:permission-prompt` y espera la respuesta
validada de `integrated-browser:permission-decide`; sin ventana o al vencer el
timeout responde denegado. Permitir una consulta provisional de `media` en una
ventana adoptada que sigue en `about:blank` no evita este contrato: la solicitud
real debe aportar origen HTTP(S) y pasar por la decision guardada, el aviso y el
permiso del sistema operativo.
Los turnos contextuales solicitan un snapshot puntual reciente: referencias a
personas, mensajes o recursos visibles se resuelven aunque no contengan un verbo
de visión.
El snapshot incluye `images`: las imágenes de contenido de la página con su URL,
su texto alternativo y su tamaño, para que el agente pueda reutilizar el material
gráfico que el usuario ya está viendo —una presentación construida sobre esa
página debe llevar sus imágenes, no unas inventadas—. Se descartan por tamaño
los iconos, avatares y píxeles de seguimiento, y los esquemas `data:` y `blob:`,
que el proceso principal no puede volver a pedir. A diferencia de las URL de
página, **la query se conserva**: en una URL de imagen suele llevar el tamaño o
la firma, y quitarla devuelve un 403 o una imagen distinta; a cambio, esa query
puede contener un token de acceso al recurso, así que viaja al modelo como parte
del contenido no confiable de la página. Los canales `integrated-browser:element-click`,
`integrated-browser:element-type` e `integrated-browser:scroll` exponen el
controlador determinista: actúan por la referencia del último snapshot, resuelven
el elemento vivo antes de enviar entrada real y se rechazan sin pestaña visible o
mientras Computer Use controla la vista.
Una secuencia híbrida puede usar Computer Use desktop para una aplicación
externa y volver a estos canales para la pestaña integrada; la superficie se
declara por paso, no existe fallback silencioso y los efectos externos conservan
confirmación HITL.

`desktop-agent:get-status` y `get-active-tasks` incluyen el ID propio de una
tarea visual de navegador desde su apertura. Los canales existentes `abort-task`
y `abort` alcanzan su controlador main; el segundo retira también la cola.
La señal nativa no cruza IPC: se crea en main y se enlaza a apertura, loop y SDK.
El acuse de abortar no acredita haber deshecho una navegación o entrada emitida;
la reserva permanece hasta terminar esa operación. No añade canales ni ofrece
pausa/reanudación del navegador.
`integrated-browser:set-observation-enabled` permite pausar y descartar esa
evidencia. El DOM omite valores de formularios, contenido editable, contraseñas
y credenciales de URL, y se entrega como contenido de página no confiable.

El navegador integrado normaliza primero `app.userAgentFallback`, antes de crear
sesiones, workers o ventanas, y repite la misma identidad en la vista y la
`Session` aislada. El fallback temprano cubre la primera navegación y los fetch
del service worker; los overrides cubren el documento y subframes posteriores.
Electron inserta el nombre y la
versión de la aplicación y la ficha `Electron/`; además, una versión prerelease
como `44.0.0-beta.3` debe retirarse completa para no pegar `-beta.3` a la versión
de Chrome. Esas marcas lo convierten en un cliente desconocido frente a lo que
anuncia `Sec-CH-UA`; los endpoints que validan esa coherencia devolvían
`FAILED_PRECONDITION`, lo que impedía cargar la transcripción de YouTube y
afectaba otros sitios que validan la identidad declarada por el navegador.
No se inyecta ninguna cabecera Client Hints ni se habilita `SharedArrayBuffer`
por una bandera global: hacerlo introducía capacidades o marcas que
contradecían las que el propio Chromium ya envía. Un `ERR_ABORTED` por
navegación reemplazada tampoco se trata como fallo: es el curso normal de un
sitio que reescribe su propia URL al cargar.

Main administra hasta 500 pestañas lógicas dentro de la misma partición
persistente y conserva como máximo ocho `WebContentsView` vivas como defensa.
Las superficies visibles ejecutan sin throttling; las ocultas lo permiten. Una
pestaña oculta reciente queda caliente para cambios rápidos y las demás se
suspenden por LRU después de 90 segundos, o 30 si la ventana está oculta. Audio,
captura, carga, DevTools, ventana separada visible y control del agente protegen
la vista; restaurarla conserva identidad y URL, pero recarga el documento.
Los popups HTTP(S) se convierten en pestañas internas. Los canales
`integrated-browser:tab-detach` y `integrated-browser:tab-reattach` permiten al
renderer principal mover una pestaña validada a una de hasta cuatro
`BaseWindow`, siempre dentro del mismo presupuesto y sesión. Una composición puede mantener una vista única,
dos mitades o una secundaria superpuesta. El foco determina `activeTabId`, que
es el único destino de navegación, captura, autofill y Computer Use.

`orb:show` permite al renderer principal autenticado abrir o enfocar la Orbe
general. El canal no expone primitivas de ventana y rechaza otro emisor.

El panel de chat no mueve la capa nativa fuera de pantalla ni compone la página
mediante polling de capturas. El renderer publica bounds con inset izquierdo o derecho y la vista
permanece viva. Solo los gestores flotantes toman una captura puntual y llaman a
`hide(true)`; al cerrarlos republican el viewport. Esa ocultación temporal conserva
el presupuesto de las vistas presentadas y evita congelarlas mientras se usa un gestor.
`hide()` conserva el comportamiento de ocultación normal. Una tarea dirigida a esta vista
falla cerrado y nunca cambia silenciosamente al backend desktop.

### Fuentes de pestañas elegidas

Los canales existentes `integrated-browser:tab-summaries` y
`integrated-browser:get-tab-content` exigen el marco principal del renderer
autenticado. El primero no acepta argumentos: devuelve metadata sin DOM y el
estado con `profileRevision`. Cada resumen añade `documentToken`, aleatorio y
no persistente. El segundo admite únicamente `{ tabId, expected? }`; el recibo
opcional contiene `profileRevision` y `documentToken`, sin permisos declarados
por renderer. Se conserva la llamada legacy sin recibo, pero los adjuntos lo
exigen y validan. No se añaden canales ni acceso genérico.

Main rechaza documentos/perfiles obsoletos antes de leer y después de autorizar,
y limita lecturas con recibo a 3000 caracteres antes de IPC. No expone query,
fragmento ni credenciales de URL. El token cambia con nueva vista o navegación,
incluida navegación interna; no certifica todas las mutaciones autónomas del DOM.
La preparación revalida el lote y aplica plazo de quince segundos; cancelación
renderer descarta resultados, no cancela físicamente una llamada nativa emitida.
La [arquitectura del navegador](integrated-browser-platform.md#adjuntos-de-pestañas-y-citas)
documenta persistencia, citas y restricciones del turno.

### Guardado de contraseñas

Los ocho canales `integrated-browser:credentials-*` sólo aceptan el frame
principal del renderer autenticado. `credentials-list` no recibe argumentos y
devuelve metadata, `credentialAutosaveEnabled` y `credentialOrigin`, obtenido de la página activa en main.
`credentials-save` recibe un único objeto cerrado con `username`, `password`,
`expectedOrigin` obligatorio e `id` opcional. Main rechaza un origen distinto,
IDs ajenos o eliminados y cambios de contexto durante la revisión. El secreto
introducido manualmente sólo viaja hacia main; nunca se devuelve por IPC.

Guardar una cuenta existente solicita confirmación nativa del reemplazo.
La respuesta distingue `{ canceled: true }` de
`{ canceled: false, credential }`; no hay token ni aprobación enviados desde
el renderer. `credentials-fill` y `credentials-remove` reciben sólo `{ id }`;
`credentials-health` no recibe argumentos. Todos rechazan argumentos extra,
frames ajenos y errores inesperados sin propagar causas con secretos o rutas.
El diálogo no es autenticación del SO y no implementa Windows Hello.

`credentials-autosave-set` recibe exclusivamente `{ enabled: boolean }` y devuelve
`{ canceled, credentialAutosaveEnabled }`. Activar exige confirmación nativa;
desactivar desmonta el observador y ambas acciones invalidan revisiones previas.
La preferencia vive cifrada por perfil. La oferta posterior a submit viaja por
un binding CDP privado en un mundo aislado propio con ID único; no existe un
canal de oferta/aprobación en la allowlist ni en el catálogo runtime. Main valida
marco principal, origen, pestaña visible, foco y control humano antes de preparar
el candidato. No hay fallback al contexto JavaScript del sitio o del agente.

### Dispositivos de sincronización

Los cuatro canales `integrated-browser:sync-devices-get/register/revoke/cancel`
exigen emisor y frame principal autenticados. `get`, `register` y `cancel` no
aceptan argumentos; `revoke` admite exclusivamente `{ id: UUID }`. Main valida
la pertenencia en el inventario autorizado y obtiene consentimiento nativo antes
de registrar o revocar. La aprobación nunca se recibe por IPC.

La respuesta `syncDevices` contiene capacidad, estado, mensaje controlado e IDs
aleatorios con etiquetas/fechas; no incluye owner, session_id, tokens, rutas ni
claves. `cancel` devuelve `{ canceled: true }` como acuse de cancelación local,
no como rollback remoto. La UI descarta respuestas al desmontar y se remonta
con `profileRevision`, un contador no identificador del estado del navegador.
No hay canales de lectura/escritura arbitraria de envelopes ni herramientas de
agente para estas operaciones. `integrated-browser:sync-control` ofrece una unión
cerrada de acciones para estado, categorías, ejecución/cancelación, pausa,
resolución y recuperación. Exportar/importar clave usa selector y confirmación
nativos; ni código, ni ruta, ni clave E2EE cruzan IPC. Los adaptadores y el
controlador main aplican los datos; el renderer no decide rutas ni escribe stores.

### Bitácora y recuperación explícita

`integrated-browser:agent-audit` sólo acepta `{ action: 'list', offset }`,
`{ action: 'clear' }` o `{ action: 'retention', days }`. Offset entero 0–5000,
retención 7/30/90 y sin campos adicionales. Devuelve `audit` paginado o
`auditChange.cancelled`; no existe IPC para fabricar eventos. Borrado/retención
exigen HITL en main, TTL de cinco minutos, perfil/ventana/control vigentes y
exclusión de diálogos concurrentes. Sólo el frame principal autenticado accede.

`integrated-browser:bookmarks-recover` y `integrated-browser:credentials-recover`
no aceptan rutas, contenido ni aprobaciones del renderer. Main valida el respaldo,
prepara conteos y solicita confirmación nativa de un solo uso. Bóveda y marcadores
admiten ausencia/corrupción reconocida, no versiones futuras ni errores de permisos.
La bóveda conserva los bytes dañados en copia protegida por el SO antes del
reemplazo; su resultado sigue siendo sólo cancelación y conteo. Ambos invalidan
revisiones obsoletas y mantienen secretos fuera de IPC. No se agrega canal para
leer archivos de cuarentena. El borrado confirmado de contraseñas retira también
las copias completas de recuperación de bóvedas dañadas, con advertencia visible.

### Borrado de datos de navegacion

`integrated-browser:clear-browsing-data` es el equivalente al "Borrar datos de
navegacion" de Chrome. Acepta categorias (`historial`, `cookies`, `cache`,
`contrasenas`, `permisos`) y un intervalo, valida ambos antes de tocar nada y
actua **solo sobre el perfil del usuario con sesion activa**: la particion se
resuelve con `browserPartitionFor()` sin argumento, de modo que el perfil de
otra cuenta no se ve afectado. No esta en el catalogo de herramientas de ningun
agente runtime: es destructiva y la dirige el usuario.

El intervalo tiene un alcance real desigual y el contrato lo declara. Chromium
sabe acotar el borrado por fecha, pero Electron no lo expone: `ClearDataOptions`
solo admite `dataTypes`, `origins` y `excludeOrigins`, y las cookies que
devuelve no traen fecha de creacion. El historial SI se acota, porque es nuestro
y cada visita guarda `visitedAt`. Las demas categorias se borran completas y su
resultado viene marcado con `ignoredRange`, que la interfaz muestra antes y
despues de borrar.

`cache` se separa de `cookies` en la llamada a `clearData` porque son casillas
distintas, y arrastra tambien `clearAuthCache()`: sin eso una sesion Basic o
NTLM sobrevive al borrado de cookies. Cada categoria corre aislada, de modo que
un fallo en cookies no impide borrar el historial, y el resumen por categoria
dice que se quito, cuanto y que fallo.

## Contexto de aplicaciones de escritorio

`desktop-context:list-apps` y `desktop-context:capture-app` permiten al chat
adjuntar el contenido de las aplicaciones que el usuario ya tiene abiertas, con
la misma ergonomia del selector de pestañas. Ambos son de lectura y ambos
verifican el emisor.

Listar es barato por diseño: cruza `DesktopWindowControls.listWindows` con las
miniaturas de `desktopCapturer` y **no** invoca COM ni recorre arboles de
accesibilidad. El inventario excluye las ventanas del propio Soflia Hub y solo
emite identificadores propios; `capture-app` rechaza cualquier identificador que
no venga de un inventario previo antes de tocar PowerShell.

La extraccion baja por la primera via que entregue contenido util:

| Nivel | Via | Cubre | Fidelidad |
|---|---|---|---|
| A | COM resuelve la ruta del documento abierto y el sidecar la lee | Word, Excel, PowerPoint | documento completo con tablas |
| B | UI Automation `TextPattern` sobre la ventana | apps con accesibilidad | texto plano |
| C | captura de la ventana | cualquier ventana | solo lo visible |

El nivel A usa COM **solo** para leer `FullName` y `Saved`: el contenido lo lee
`python-tools-service.ts` desde el disco. Acotar COM a un metodo de solo lectura
hace verificable que este flujo no puede modificar el documento del usuario. Si
el documento tiene cambios sin guardar, el adjunto se marca como desactualizado
en el chip y en el bloque de contexto en lugar de silenciarlo.

El nivel B vive en `electron/desktop-context/uia-text.ts`, separado del
extractor de `desktop-agent`: aquel parte de `GetForegroundWindow` y filtra a
elementos interactivos para decidir donde hacer clic, y reutilizarlo obligaria a
traer al frente cada ventana marcada.

Fuera de Windows solo esta disponible el nivel C, y la respuesta del inventario
lo declara para que la interfaz no prometa una fidelidad que la plataforma no
puede dar. `SOFLIA_DISABLE_DESKTOP_CONTEXT=1` no registra los handlers: el
renderer ve la API ausente y oculta la entrada del menu.

## Entrada multimodal

Los canales `media-input:*` suben medios al proveedor del modelo. Viven en main
por presupuesto de memoria: subir desde el renderer obligaría a leer el archivo
entero como `ArrayBuffer`, y un video de cientos de megabytes no cabe ahí. El
renderer entrega la **ruta** y recibe la referencia remota; el contenido nunca
cruza la frontera IPC.

La ruta del archivo se obtiene en el preload con `webUtils.getPathForFile`:
desde Electron 32 `File.path` ya no existe y es la única forma de resolverla sin
leer el archivo.

| Canal | Efecto |
|---|---|
| `media-input:upload` | Sube el archivo por flujo desde disco y espera a que el proveedor lo declare procesado, con límite de tiempo para no bloquear el turno. Valida formato y tamaño antes de transferir. |
| `media-input:status` | Estado de una subida: `processing`, `ready`, `failed` o `cancelled`. |
| `media-input:cancel` | Aborta una subida en curso y suelta el archivo remoto si alcanzó a crearse. |
| `media-input:release` | Borra el archivo remoto al terminar o cancelarse el turno que lo consumía. |

Cada subida pertenece a la identidad y generación de la sesión main. Solo el
frame principal puede operarla; cerrar sesión o cambiar de cuenta invalida sus
referencias y las operaciones pendientes comprueban de nuevo la identidad tras
cada espera. El servicio y el hook están disponibles, pero el compositor actual
todavía no conecta esta ruta de subida para audio y video de gran tamaño.

Los errores del proveedor se sanean antes de volver al renderer: ni la clave de
API ni la ruta local completa aparecen en el mensaje. La primera transferencia
de la sesión requiere consentimiento explícito del usuario, porque el archivo
deja el equipo y permanece temporalmente en la infraestructura del proveedor.

Los canales de visión del navegador amplían el contrato existente:

| Canal | Efecto |
|---|---|
| `integrated-browser:capture-frame` | Cuadro fresco de la pestaña visible a resolución del viewport, con evaluación de utilizabilidad en main. Devuelve el motivo cuando la captura no representa lo que el usuario ve. |
| `integrated-browser:get-player-state` | Posición, duración y URI pública del reproductor activo. Solo observa: no reproduce, pausa ni navega. |
| `integrated-browser:sample-frames` | Secuencia de cuadros con marcas de tiempo para un reproductor no direccionable. |
| `integrated-browser:cancel-frame-sampling` | Cancela el muestreo identificado por `requestId`, sin iniciar nuevas capturas. |

Estas lecturas aplican la autorización del sitio, el bloqueo de documentos sensibles
y la pausa de percepción. Fijan identidad, pestaña y documento durante las esperas;
un cambio invalida la operación. El muestreo admite un `requestId` único y limitado
a 80 caracteres alfanuméricos o guiones; el handler admite hasta cuatro solicitudes
simultáneas y las cancela al cambiar la sesión. La herramienta propaga la señal
de parada del turno a la cancelación IPC.

## Espacio de trabajo de Skills y presentaciones

Los canales `skill-workspace:*` operan **solo dentro** del workspace que indica
su identificador. El renderer y el modelo manejan siempre rutas relativas: la
ruta absoluta no cruza la frontera IPC, de modo que no puede reutilizarse contra
otras herramientas del sistema. No existe ningún canal de ruta absoluta ni de
ejecución en este espacio de nombres.

| Canal | Efecto |
|---|---|
| `skill-workspace:create` | Crea el workspace de una Skill del sistema con su política. |
| `skill-workspace:find-by-conversation` | Recupera el workspace asociado a una conversación. |
| `skill-workspace:attach-conversation` | Ata el workspace a la conversación cuando esta se crea después que él (chat nuevo). Nunca reasigna: si ya pertenece a otra conversación, falla. |
| `skill-workspace:get-state` | Archivos, tamaño total y si existe el documento de entrada. |
| `skill-workspace:read-file` / `write-file` / `edit-file` / `delete-file` | Operaciones acotadas con validación de contención por `realpath`. |
| `skill-workspace:write-image` | Guarda en `assets/` una imagen generada por el modelo; el nombre se sanea y la extensión debe ser PNG, JPEG o WebP. |
| `skill-workspace:download-image` | Descarga una imagen HTTPS y la guarda en `assets/`. Las guardas de red viven en main (ver abajo). |
| `skill-workspace:open-folder` | Abre la carpeta en el explorador del sistema operativo. |
| `skill-workspace:progress` | Evento por archivo (`en_curso`, `completado`, `error`) que alimenta el panel. |
| `skill-workspace:preview-url` | URL `pulse-presentacion://` del documento; falla si aún no existe. |
| `presentation-view:open` / `close` / `closed` | Vista nativa a pantalla completa, creada bajo demanda y destruida al cerrar. |
| `presentation:export-html` | Empaqueta la presentación en un HTML autocontenido: estilos incrustados e imágenes en `data:`. |
| `presentation:prepare-branding` | Resuelve la identidad de la organización y escribe `estilos/marca.css`. |

El protocolo `pulse-presentacion://` se declara privilegiado **antes** de
`app.ready` (`electron/main.ts`) y su handler se registra después **en cada
sesión que lo use**: la del renderer, que carga el `iframe`, y la partición
propia de la vista a pantalla completa. `protocol.handle` del módulo solo afecta
a la sesión por defecto; una `WebContentsView` con partición propia se quedaría
sin handler y el sistema operativo recibiría el esquema como enlace externo. Sirve
exclusivamente archivos del workspace indicado, reutilizando la misma validación
de contención del servicio, devuelve 404 para cualquier otra ruta o extensión
desconocida, y envía una CSP sin `connect-src`, de modo que el documento no
puede pedir recursos remotos. La vista previa embebida lo carga en un `iframe`
con `sandbox="allow-scripts"` **sin** `allow-same-origin`: origen opaco, sin
acceso a las APIs de preload.

**Imágenes en el workspace.** Son la única vía por la que entra un binario, y
por eso no comparten camino con las escrituras de texto: el nombre lo sanea main
(se descarta la ruta propuesta y se fuerza el prefijo `assets/`), la extensión
debe ser PNG, JPEG o WebP, y el tamaño tiene tope propio además del presupuesto
del workspace. La generación ocurre en el renderer, que ya tiene configurado el
modelo de imagen; main solo escribe los bytes. La descarga sí ocurre en main
(`electron/skill-workspace/fetch-image.ts`) porque la URL la elige el modelo a
partir de fuentes que no controlamos: solo HTTPS, sin destinos privados ni
enlace-local, con `redirect: 'manual'` para revalidar cada salto —una URL pública
que redirige a `169.254.169.254` es el caso que esto cierra—, límite de tamaño y
de tiempo. Poner esas guardas en el renderer no serviría: una respuesta
manipulada podría saltárselas.

Para presentaciones, el renderer reutiliza esta misma frontera antes de llamar
al proveedor: guarda los visuales adjuntos con `write-image` y descarga una
selección saneada del DOM con `download-image`. El agente recibe únicamente las
rutas relativas resultantes en un manifiesto; no recibe rutas absolutas, no
enlaza URLs remotas en `deck.json` y un recurso fallido no revierte los que ya
quedaron dentro de `assets/`.

## Integraciones y propietarios

| Integracion | Cliente/servicio | Configuracion | Patrón de fallo |
|---|---|---|---|
| Gemini | dos SDK + REST/Live WebSocket | `VITE_GEMINI_API_KEY`, modelos en `src/config.ts` | fallback de modelo, timeout, error publico |
| Supabase Lia | renderer + main por dominio | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | diagnostico/degradado Lia |
| Supabase SOFIA | renderer auth/org | `VITE_SOFIA_SUPABASE_*` | bloquea auth principal si no configura |
| SSO SofLIA Learning | navegador del sistema + deep link `soflia://auth/callback` | `VITE_LEARNING_BASE_URL`, `VITE_LEARNING_SSO_ENABLED` | entrada no se ofrece con el interruptor apagado; el inicio por contrasena no depende de ella |
| Project Hub/IRIS | API REST desde Electron main | `PROJECT_HUB_API_URL` | UI degradada con reintento; carpetas heredadas intactas |
| Google OAuth/APIs | Calendar auth compartido | `VITE_GOOGLE_OAUTH_CLIENT_ID/SECRET` | conexion por usuario, refresh y desconexion |
| Microsoft Calendar | MSAL/Graph | `VITE_MICROSOFT_CLIENT_ID` | conexion separada por provider |
| ElevenLabs | REST binario y `with-timestamps` desde main | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; default `eleven_turbo_v2_5`, formato opcional | Orbe conserva texto sin voz; lector visual disponible; errores saneados de permiso, cuota o timeout |

En desarrollo, `npm run dev` ejecuta `scripts/dev-with-project-hub.mjs`: comprueba
`PROJECT_HUB_API_URL` (por defecto `https://sofliahub.netlify.app`). Para trabajar
contra la API local se define explícitamente `PROJECT_HUB_API_URL=http://127.0.0.1:3000`;
si no responde, el script inicia automáticamente el workspace hermano antes de
Vite/Electron. La ruta puede sobrescribirse con `PROJECT_HUB_DEV_ROOT`. Una URL
remota nunca provoca el arranque de procesos locales.

Los instaladores reciben el endpoint público mediante
`VITE_PROJECT_HUB_API_URL` durante el build. `PROJECT_HUB_API_URL` puede
sobrescribirlo en runtime para diagnóstico o despliegues administrados. Como
compatibilidad con instaladores construidos por pipelines anteriores, se usa
`https://sofliahub.netlify.app`. Localhost requiere una sobrescritura explícita
con `PROJECT_HUB_API_URL`.
| WhatsApp | Baileys WebSocket | QR + config en `userData` | reconnect/status; allowlists |
| Telegram | Bot API | config cifrada/estado local del servicio | test de conexion y status |
| SMTP | Nodemailer | configurado via handlers computer | confirmacion de envio y error seguro |
| GitHub Releases | electron-updater/Actions | repo publico de releases + token solo CI | check/download/install por estado |
| Home Assistant | toolset dinamico builtin | URL/token provistos al instalar | doctor, contrato, timeout y HITL write |
| Nodos remotos | servicio propio de host/node | config en `userData` | status/test y capability de canal |

## Protocolo `soflia://` e inicio federado

`parseAppProtocolCommand` acepta tres comandos: `share/<token>`,
`meeting-trigger` y `auth/callback`. El enrutado cubre las tres vias de entrada
de un deep link: `second-instance` (Windows y Linux con la aplicacion abierta),
`process.argv` en arranque en frio, y `open-url` en macOS, que es el unico canal
por el que esa plataforma entrega el enlace.

El inicio federado usa dos canales IPC: `auth:open-sso`, que abre el navegador
del sistema, y `app:auth-callback` junto con `app:get-pending-auth-callback`,
que entregan el retorno al renderer en caliente o tras un arranque en frio.

Dos limites que no deben relajarse:

- El renderer **no envia una URL** por `auth:open-sso`, solo su `state` y su
  desafio. La direccion la construye el proceso main desde la configuracion, de
  modo que el canal no sirva para abrir una direccion arbitraria en el navegador
  del usuario.
- El verificador PKCE vive solo en memoria del renderer. No cruza a main, no se
  persiste y no aparece en registros. Es lo unico que hace inservible un ticket
  interceptado por otra aplicacion que haya registrado el mismo esquema.

## Limites de contrato

`integrated-browser:set-viewport` conserva el canal existente y usa el contrato
compartido [BrowserViewport](../../src/shared/browser-navigation.ts). El booleano
opcional `homeInShell` se valida sin coerción en main y sólo evita dibujar la
portada local nativa cuando el renderer ya la compone en modo simple. Omitirlo
conserva el comportamiento nativo; no permite ejecutar HTML ni protocolos nuevos.

Project Hub usa canales `project-hub:*` con métodos de dominio. El par de tokens
SOFIA entra por `auth:set-state` para autenticar el cliente SOFIA de main; el
access token también alimenta el canje verificado de Project Hub. Los tokens
Project Hub no cruzan preload. Main conserva access tokens en memoria y cifra
cada refresh token por separado con `safeStorage`. `auth:get-state` nunca
devuelve credenciales. El renderer puede recibir una URL de upload o descarga
firmada y efímera, pero nunca una clave Supabase o un token OAuth de Drive. El
contrato completo y los estados de degradación se documentan en
[Project Hub unificado](project-hub-unified.md).

`auth:set-state` admite también `organizationId` opcional y validado como
selección privada. No cambia la salida de `auth:get-state` ni concede acceso:
el generador comprueba sesión SOFIA y membresía activa. Los documentos en
preparación se invalidan si cambia esa selección. El contrato y la recuperación
de logo/paleta se mantienen en [Diseño de documentos](generated-documents.md).


- Variables `VITE_` quedan incrustadas por Vite incluso para main; no deben
  considerarse secretos de backend. Las claves anon publicas de Supabase dependen
  de RLS; credenciales privilegiadas no deben usar este mecanismo.
- OAuth tokens no se documentan ni se envian al renderer salvo metadata segura.
- No existe garantia de disponibilidad de terceros; cada UI debe soportar no
  configurado, desconectado, rate limit y timeout.
- `docs/contracts/openapi.json` no enumera IPC y no debe usarse como allowlist.

## Equipos ejecutores de fondo

`background-teams:context`, `release`, `state`, `start`, `control`, `attach-legacy` y `open`
son operaciones cerradas; `changed` es una notificación sin contenido sensible.
Servicio: `electron/background-teams/`; handler validado y restringido al frame
principal del Hub; preload allowlisted; wrapper `src/services/background-teams.ts`.
La identidad se deriva de la sesión main, y actor/organización esperados en la
admisión solo detectan cambios de contexto. Un token de generación impide devolver
datos antiguos después de una espera. Abrir admite job/artefacto UUID, nunca una ruta
libre, y comprueba hash antes de invocar la apertura local.
No hay canal para ejecutar shell, enviar correos o conceder herramientas arbitrarias.
Véase [contrato funcional](runtime-multiagent-harness.md#equipos-ejecutores-locales-en-segundo-plano).


## Visor de archivos y entregables

<!-- evidence: electron/artifact-viewer/handlers.ts -->
<!-- evidence: electron/preload/artifact-viewer-api.ts -->
<!-- evidence: src/services/artifact-viewer.ts -->

`artifact-viewer:preview`, `pick`, `open-external` y `save-copy` son cuatro
operaciones cerradas del frame principal del Hub. El contrato compartido vive
en `src/shared/artifact-viewer.ts`. El visor resuelve referencias de equipo
(trabajo/archivo UUID) o IDs efímeros de archivos elegidos en el selector nativo.
No acepta rutas desde IPC ni devuelve rutas del disco. Autorización y generación
se comprueban después de esperas, selectores y lectura. Las referencias locales
quedan ligadas al contexto y hash del archivo; los entregables reutilizan la
validación e integridad del repositorio de equipos.

La respuesta distingue texto/Markdown, HTML de lectura Word, tablas Excel/CSV,
contenido de diapositivas, PDF e imágenes. Office tiene un límite de expansión
ZIP antes del lector; celdas, hojas y filas se acotan y se avisa del truncamiento.
Las fórmulas usan valores guardados y no se evalúan en el visor. HTML interactivo
se sirve desde loopback efímero por rutas UUID y generación, con Host exacto y CSP
por encabezado. El iframe opaco deniega red, subframes, workers y privilegios;
un preámbulo inmutable cierra WebRTC y main bloquea navegación. Word usa el mismo servidor
en modo de lectura con scripts denegados. PDF usa PDF.js en un worker local e imágenes
se decodifican en main. Los blobs de imágenes se revocan y el worker PDF se destruye al desmontar su vista.

Guardar copia usa un selector nativo y creación exclusiva, sin sobrescribir
originales. Abrir fuera requiere una acción explícita y un formato permitido;
La apertura externa usa una copia temporal de los bytes verificados, evitando
la sustitución de la ruta original. HTML permanece en el sandbox. No hay
edición Office ni ejecución de binarios.
Véase [especificación del visor](../../openspec/changes/preview-generated-artifacts/specs/artifact-preview/spec.md).

## Selector local de pantalla

<!-- evidence: electron/integrated-browser/display-media-picker.ts -->
<!-- evidence: electron/preload/display-media-api.ts -->
<!-- evidence: src/services/display-media-picker.ts -->

`display-media:list`, `select` y `cancel` sirven únicamente al frame principal
de una ventana efímera creada por main. El preload de esa ventana expone solo
`displayMediaPicker`; el renderer del Hub y las páginas remotas no reciben las
miniaturas ni pueden seleccionar mediante estos canales. Se reutiliza el mismo
selector para el Hub, el Meeting SDK y el navegador integrado.
La página solicitante recibe solo la fuente confirmada. Se revalida la existencia
de pantallas/ventanas y el documento/perfil de pestañas al confirmar. Audio del
sistema desactivado por defecto, únicamente cuando fue solicitado en Windows.
Cancelar, Escape, cerrar, navegación del padre, crash o timeout liberan el estado.
Las pestañas disponibles son vistas materializadas del navegador del Hub;
Chrome/Edge externos se comparten como ventanas. No se enumeran pestañas sensibles
ni las que están bajo control del agente. [Especificación del selector](../../openspec/changes/implement-live-studio-runtime/specs/display-media-picker/spec.md).

Los vínculos de producción se gestionan con `studio-capture:choose`, `activate`,
`release` y `clear`, solo desde el frame principal autenticado del Hub.
`electron/studio-capture/` custodia concesiones UUID, nunca elegibles por nombre
desde el renderer. `electron/preload/studio-capture-api.ts` y el wrapper
`src/services/studio-capture.ts` completan las capas del contrato.
Elegir una fuente abre el selector propio en modo Vincular, sin transmisión.
Activar prepara la fuente para la próxima solicitud del SDK; la vista local usa
una concesión de un solo uso que vence a los diez segundos. La ruta independiente
de loopback no consume esta concesión. Quitar/cancelar/salir/cambiar identidad
liberan los vínculos. Fuente perdida cancela la captura sin elegir un sustituto.
Véase [escenas locales](../../openspec/changes/implement-live-studio-runtime/specs/studio-local-scenes/spec.md).

## Project Hub

La superficie tiene 23 canales: nueve lecturas/autenticación, diez mutaciones de
dominio y cuatro operaciones para subir/guardar copia y cancelarlas. Subir/cancelar sustituyen las primitivas
create-upload-intent/complete-upload en la allowlist; el protocolo v1 sigue en main.
Guardar copia/cancelar sustituyen get-download; no se entrega URL firmada al
renderer. Selección de destino y publicación exclusiva son responsabilidad main.
`electron/project-hub-handlers.ts` usa caller común cerrado y confirmación nativa;
`electron/project-hub/` conserva custodia y autorización interna hasta HTTP.
Allowlist del grupo 5, `electron/preload/project-hub-api.ts` y el wrapper
`src/services/project-hub-api.ts` comparten tipos de `src/shared/project-hub.ts`
y `src/shared/project-hub-files.ts`.
La actualización de tarea dispone ahora de wrapper, completando su ruta existente.
No se expone transporte genérico, tokens de sesión, URLs firmadas ni rutas de archivos.

Aridad exacta, schemas cerrados, snapshot acotado y caller vigente antes/después
de esperar. Todas las mutaciones piden HITL tras comprobar destino; la aprobación
no se transfiere a otro IPC. Contexto perdido descarta datos, aborta red o retira
espera y conserva incertidumbre si ya se invocó una escritura. El backend sigue
autorizando roles/recursos. [Contrato y límites](project-hub-unified.md#autorización-ipc).

## Exportación y audiovisual local

La salida continua del curso usa `studio-output:open`, `close`, `offer`, `answer`,
`state` y `event`. El frame principal autenticado dueño solo prepara/cierra y
recibe estado. El preload `--studio-output` expone únicamente offer/answer/state
al receptor creado por main. Oferta/respuesta SDP de hasta 64 KiB, ID UUID y
timeout de negociación; sin archivos ni credenciales de Learning. Main revalida
actor, ventana/frame exactos y generación. Cierre, navegación, cambio de cuenta,
crash o timeout destruyen el receptor y revocan la concesión. La llamada recibe
su WebFrameMain solo después del primer frame; la preparación pendiente deniega
captura sin elegir otra fuente. [Contrato de salida](../../openspec/changes/add-studio-transitions/specs/studio-program-output/spec.md).

`presentation:export-pptx` publica un PPTX editable del deck validado. `audiovisual:inspect`, `audiovisual:render` y `audiovisual:cancel` reciben solamente workspaceId, validado mediante esquema estricto; el servicio comprueba la skill propietaria. Allowlist, preload y wrapper tipado no exponen shell, ejecutables ni escritura binaria genérica. Contratos y límites en [producción audiovisual](presentation-audiovisual-production.md).

## Voz local y Orbe

Los nueve canales de ajustes conservan argumentos y allowlist; los contratos
compartidos son `src/shared/local-voice.ts` y `src/shared/orb.ts`, con preload y
wrappers por capacidad. Main valida emisor/marco/documento/sesión y payload
antes del efecto. `enabled` no concede micrófono; captura/restauración e
instalación pasan revisión nativa, con detención disponible durante esperas.
Dictado/Piper entregan al consumidor vigente y síntesis propaga cancelación.
Roles, DTO, revocación y límites de recuperación:
[autorización de voz local](../security/local-voice-authorization.md).

## Documentos Python y contexto de escritorio

Los cinco `pytools:*` usan `src/shared/python-tools.ts`, preload específico y
wrapper tipado. `parseDocument()` renderer es de cero argumentos y selección
nativa; las rutas permanecen en main. Ambos IPC `desktop-context:*` revalidan
caller y contexto tras esperar, y el inventario se retira al cambiar sesión.
No hay canales nuevos. Persistencia, cuotas y consumidores protegidos en
[frontera documental](../security/python-document-boundary.md).
