# Seguridad y privacidad

Estado: vigente. Actualizado: 2026-10-22.

<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: ai-specs/policies/tool-boundaries.md -->

## Activos protegidos

En el navegador, voz sólo acepta comandos cerrados desde la Orbe autenticada,
visible y su marco principal. Memoria semántica exige opt-in nativo: Google
recibe títulos, URL sin parámetros/fragmento y consultas, potencialmente
personales y con coste; no páginas ni formularios. El índice local usa cifrado
del SO, no E2EE ni sincronización; cancelar no retira datos enviados.

La bóveda inicia bloqueada; sólo Windows Hello/PIN verificado por el SO abre
una sesión temporal. No recibe PIN, biometría ni contraseña de Windows. No hay
fallback a confirmar por IPC, ni a guardar sin cifrado. Esta barrera es de la
aplicación: no convierte DPAPI en una clave ligada criptográficamente a cada
verificación, ni protege contra malware con control de la cuenta local.

La sonda sensible local no envía datos: devuelve sólo categoría y bloquea
lectura/captura/actuación integrada del documento detectado hasta navegación
nueva. No es un clasificador infalible de imágenes/texto arbitrario ni una
política global de capturas de escritorio. Alcance y rutas en
[plataforma del navegador](../architecture/integrated-browser-platform.md).

- sesiones SOFIA/Supabase y tokens OAuth;
- credenciales WhatsApp/Telegram/SMTP y API keys;
- conversaciones, archivos, transcripciones, screenshots/OCR y memoria;
- cookies, almacenamiento y sesiones de la particion del navegador integrado;
- historial, credenciales cifradas y extensiones locales del navegador integrado;
- favoritos locales del navegador integrado, limitados a título, URL HTTP(S)
  sin credenciales y fecha de creación;
- filesystem, procesos, portapapeles, mouse/teclado y nodos remotos;
- decisiones/aprobaciones y efectos externos (correo, mensajes, issues, eventos);
- pipeline de release y token de repositorio de distribucion.

## Fronteras de confianza

```text
contenido/modelo/proveedor externo (no confiable)
  -> renderer sandbox
  -> preload allowlist + sanitizacion
  -> handler main + validacion/autorizacion/HITL
  -> servicio local o API remota
  -> DB/RLS/constraint o sistema operativo
```

Canales WhatsApp/Telegram, paginas web, documentos, OCR y toolsets instalados son
entrada no confiable. Un resultado de IA es propuesta; no es identidad, permiso ni
aprobacion.

## Controles implementados

| Capa | Control | Evidencia |
|---|---|---|
| Ventana | sandbox, context isolation, Node off | `electron/main/window-controller.ts`, `orb-window-controller.ts` |
| Preload | canales permitidos por allowlist, sanitizacion y CSP | `electron/preload/`, `electron/__tests__/preload/channel-cases.ts` |
| Navegador integrado | particion propia, sin preload/Node, HTTP(S), popup confinado, boveda metadata-only y extensiones con HITL | `electron/integrated-browser/` |
| Skills | la clase se deriva de la fuente, no de una columna; una Skill del usuario no declara herramientas y ninguna Skill puede activar lo que su superficie prohibe | `src/shared/skills/registry.ts`, `src/shared/skills/surface-tools.ts`, `src/services/skills/catalog.ts` |
| Herramientas no concedibles desde el catalogo | una fila de `system_skills` NUNCA puede concederse envio de correo o de mensajes a un espacio, escritura sobre buzon/calendario/Drive, control del equipo, ejecucion de comandos ni borrado. La lista es explicita por herramienta, no por prefijo: con `gmail_*`, cada herramienta de escritura anadida al runtime quedaria concedida sola | `src/shared/skills/surface-tools.ts` (`NEVER_FROM_SKILLS`) |
| Canales por Skill | la eleccion del usuario acota lo que declara el catalogo y nunca lo amplia; activar un canal no concede herramientas ni datos que la superficie no conceda, y las guardas del canal (grupo, autorizacion del remitente, allowlist) se aplican por encima | `src/shared/skills/channels.ts`, `electron/skill-catalog/channel-skills.ts`, RLS de `public.user_skill_channels` |
| Seleccion de herramientas por Skill | ACOTA y nunca amplia: se interseca con lo que la superficie ofrece y el canal autoriza. Seleccionar NO retira las confirmaciones de las operaciones destructivas. Lista propia (`USER_SELECTABLE_TOOLS`) separada de la de las filas del catalogo (`NEVER_FROM_SKILLS`), que no se relaja | `src/shared/skills/tool-selection.ts`, `src/shared/skills/surface-tools.ts` |
| Credenciales Lia y SOFIA en main | solo cada *refresh token*, en archivos separados y cifrados con `safeStorage`; si el sistema no ofrece cifrado NO se persisten (no se degrada a texto plano); no se registran, no vuelven al renderer, la identidad SOFIA se compara con el usuario esperado y ambos se borran al cerrar sesión | `electron/main/encrypted-refresh-token-store.ts`, `electron/main/hub-session.ts`, `electron/main/sofia-session.ts`, `electron/auth-state-handlers.ts` |
| Skills pasivas | una fila por regla con `user_id` y RLS por `auth.uid()` en las cuatro operaciones; sustituye a la fila global compartida de `hub_service_state`, donde la ultima escritura ganaba y cualquier clave anonima leia los prompts de todos | `public.passive_skills`, `electron/passive-skills/repository.ts` |
| Anuncio proactivo de la orbe | sin sesion iniciada no se muestra la orbe ni se locuta nada, y al cerrar sesion la cola pendiente se descarta; se muestra sin robar el foco | `electron/main/orb-announcements.ts` |
| Workspace de Skills | contencion por `realpath` (cierra el escape por enlace simbolico), rechazo de rutas absolutas y `..`, allowlist de extensiones, limites de tamano y archivos protegidos que el modelo no puede reescribir | `electron/skill-workspace/paths.ts`, `electron/skill-workspace/service.ts` |
| Render de presentaciones | protocolo local que solo sirve el workspace indicado, CSP sin `connect-src`, `iframe` con `sandbox="allow-scripts"` sin `allow-same-origin` y vista nativa sin preload en particion propia | `electron/skill-workspace/protocol.ts`, `electron/skill-workspace/presentation-view.ts` |
| Directorio de usuarios SOFIA | `public.users` NO es legible con la clave anon ni por tabla: el escritorio la alcanza solo por funciones `SECURITY DEFINER`. Antes de autenticar solo se puede traducir un identificador a su correo (nada mas); ya autenticado solo se obtiene la fila propia (`auth.uid()`) y, para la lista de miembros y el modal Compartir, el perfil minimo (usuario, correo, nombre y foto) de los miembros de una organizacion de la que quien llama es miembro activo, paginado y sin telefono ni datos personales. La clave anon viaja dentro del ejecutable, asi que un GRANT sobre esa tabla equivaldria a publicar el directorio | `database/sofia-learning/migrations/desktop-users-read-access.sql`, `database/sofia-learning/migrations/desktop-organization-members.sql`, `src/services/sofia-auth/login.ts`, `src/services/sofia-auth/profile.ts`, `src/services/org/operations.ts` |
| Branding | solo columnas de presentacion, descarga restringida al host de Supabase SOFIA con limite de tamano y timeout, colores validados antes de entrar al CSS | `electron/organization-branding/` |
| Handlers | payloads serializables y servicios por dominio | `electron/*-handlers.ts` |
| Canales | principal, rol, scope y capabilities | `electron/communication-hub/authorization.ts` |
| WhatsApp | normalizacion, allowlists, politica de grupo y tools bloqueadas | `electron/whatsapp/security.ts`, `electron/wa-agent/tool-declarations.ts` |
| Tools dinamicas | contrato cerrado, agent/group/HITL, timeout, fingerprint, audit | `electron/mcp-manager/` |
| Comandos | longitud, patrones/sandbox y confirmacion | `electron/security/command-policy.ts`, `electron/whatsapp-remote-hub/` |
| Datos | constraints, indices y RLS | `database/` |
| Release | secrets solo Actions, token validado y permisos `contents: read` | `.github/workflows/release.yml` |

## Acceso efectivo IRIS

La [inspección IRIS de metadatos efectivos](../reports/iris-access-2026-10-22.md)
confirma 30 tablas públicas sin RLS y políticas de membresía sin predicado del
actor. Los accesos directos heredados no reciben la protección del canje de la
API Project Hub v1. No se ha probado explotación ni aplicado remediación remota;
el rollout debe asegurar identidad/consumidores antes de revocar permisos o
habilitar RLS. La inspección no leyó registros de negocio ni credenciales.

## Custodia local de Project Hub

La [custodia por propietario](../architecture/project-hub-unified.md#flujo-de-autenticación)
exige identidad main y SOFIA coincidentes; usa cifrado asíncrono del SO y archivo
versionado con propietario interno. Nunca entrega tokens Project Hub al
renderer. Status anónimo no lee disco/red. Cambios de identidad, A/B/A y logout
invalidan trabajo pendiente; las mutaciones no se repiten automáticamente tras
401 o error de red. HTTP tiene cuotas, timeout, redirects bloqueados y errores
públicos propios sin mensajes/códigos remotos crudos.

La comprobación nativa usa Electron/DPAPI, procesos separados y perfil temporal
con credenciales ficticias. No usa una cuenta real ni acredita autorización,
revocación JWT o RLS del backend. El legado global sin dueño permanece sin
leer/asignar; sus bytes no se certifican ni se eliminan.

La [frontera IPC](../architecture/project-hub-unified.md#autorización-ipc)
añade caller/frame/documento exactos, schemas acotados y HITL nativo para sus
diez mutaciones de dominio, el lote nativo y la copia local. Verifica destino y propaga cancelación
hasta HTTP; no confía en approved=true del renderer. La confirmación es resumen
de alcance, no vista íntegra de textos grandes. No acredita autorización/RLS
del servidor. La [subida nativa](../architecture/project-hub-unified.md#subida-nativa-de-archivos)
mantiene bytes y token temporal en main, valida origen/path/token y bloquea
redirects/retry. Revisa bytes/hash tras aprobar y comunica progreso parcial;
no aplica limpieza remota ni elimina huérfanos. La
[copia local](../architecture/project-hub-unified.md#copia-local-de-archivos)
mantiene URL/bytes en main, valida evidencia/origen/path/hash/tamaño/formato y
publica una copia nueva sin sobrescribir ni ejecutar. Cancelar después del commit
conserva saved=true; fallo no confirmado de publicación informa incertidumbre
y pide revisar destino, sin afirmar rollback. Crash/cleanup fallido puede dejar staging propio. No
certifica directorios controlados por un actor local con escritura, antivirus
ni documentos OOXML completos. RLS y revocación del servidor conservan revisión pendiente. Evidencia de
custodia y sus límites en
`openspec/changes/secure-project-hub-session-custody/`.

## Sidecars Python

El transporte de [sidecars Python](../architecture/backend-electron.md#procesos-y-recursos-secundarios)
liga mensajes y pendientes al hijo propietario, exige ready compatible y limita
framing/cola/requests. No registra stdout/stderr crudos ni reutiliza respuestas
retiradas. No sustituye autorización IPC, validación semántica de eventos, política
de micrófono o aislamiento del entorno heredado por los servicios. Los demás
logs de voz/documentos y las descargas de modelos mantienen revisión pendiente.

## Calendario IPC

Los handlers de calendario requieren sesión, ventana main/orbe registradas y su
marco principal. Las mutaciones llevan schema cerrado y confirmación nativa
contextual. Se rechazan aceptación tardía, cambio de sesión/navegación/conexión
y diálogos concurrentes. Los eventos públicos omiten conexiones y tokens; los
errores remotos se sustituyen por mensajes genéricos. Ver el [contrato](../architecture/ipc-and-integrations.md#calendario).
La persistencia OAuth usa custodia asíncrona del SO por usuario, con validación
interna del propietario y sin fallback plano. La migración sella el archivo
heredado sin eliminar sus registros ni adjudicar conexiones sin dueño. El
servicio limpia memoria al cambiar identidad; clientes OAuth retenidos también
rechazan transporte fuera del contexto vigente. El smoke nativo usa DPAPI y
credenciales ficticias en un perfil temporal, sin inspeccionar perfiles reales.

La protección del SO no aísla de otro proceso bajo el mismo usuario de Windows;
no sustituye controles de acceso del equipo. Linux rechaza basic_text/unknown.
Las claves compartidas del build y los scopes OAuth amplios siguen como deuda
separada. Ver [custodia y operación](../operations/configuration.md#custodia-del-calendario).

## Planes privados de Gmail

La organización por planes tiene custodia cifrada por pareja usuario/cuenta
Google, validación interna de propietario y mínimo contenido persistido. Comparte
cifrado asíncrono del SO y escritura privada atómica con calendario. No hay
fallback plano ni adopción de planes heredados sin dueño; esos archivos antiguos
pueden conservar datos sin cifrar y requieren gestión explícita aparte.

Los tres canales de planes exigen actor/frame/documento autorizados; apply/undo
requieren HITL nativo. Las guardas de sesión/conexión se revalidan tras esperas.
Una señal de cancelación de la llamada alcanza el diálogo y el transporte del
SDK; las solicitudes tienen timeout y reintentos desactivados. También se
propaga esta señal al envío Gmail y a las confirmaciones del calendario.
El diario previo a cada efecto evita repetir automáticamente operaciones de
resultado incierto. No garantiza exactamente una ejecución ni recupera por sí
solo efectos aceptados por Google. Las operaciones directas tienen los controles
descritos en el apartado siguiente.
Ver [contrato](../architecture/ipc-and-integrations.md#planes-de-organización-de-gmail).

## Buzón Gmail directo

Los nueve canales directos de lectura/etiquetas/papelera validan actor, ventana,
frame principal, documento y esquema en main. Las seis mutaciones requieren
aprobación contextual con cuenta y alcance, comparten exclusión con planes y
detienen llamadas nuevas al cambiar sesión/conexión. El SDK recibe señal,
timeout y retry:false. No se delegan permisos al renderer ni se amplía allowlist.
Nombres con controles/bidi, IDs inválidos y referencias ambiguas se rechazan.
Lecturas tardías no revelan contenido a otra sesión; errores/logs omiten payload.

El snapshot previo a lotes impide repetir la primera página al conservar origen;
las precondiciones evitan borrar etiquetas de sistema o vaciadas parcialmente.
Los resultados indican avance parcial e incertidumbre sin ocultar confirmaciones.
Este avance es efímero: un crash exige reconciliación humana, sin un diario
general de operaciones directas. Los controles runtime previos y su configuración
de confirmaciones no se certifican ni se modifican con este bloque IPC.

## Alcance del feedback Gmail en WhatsApp

El loop ya no consulta el resto de una etiqueta ni añade instrucciones de
vaciado después de modificar un mensaje. Se retiró el estado transversal del
verificador y sus logs de IDs/errores crudos. Los resultados reales del servicio
conservan partial/uncertain/recoveryRequired y cancelación; los tres ejecutores
Gmail sanean excepciones inesperadas. La paginación se expresa como datos.

Responses rechaza resultados sin llamada correspondiente sin promoverlos a
mensaje user; tampoco publica un prefijo válido de un lote con llamadas inválidas.
Las guardas de catálogo, grupo, intención y HITL se mantienen. Esta corrección
no acredita toda la política semántica del modelo ni la redacción integral del
historial operativo, que sigue siendo una superficie separada.
Ver [manual runtime](../architecture/runtime-agents-manual.md).

## Privacidad de telemetría de herramientas WhatsApp

Los nuevos eventos operativos `kind:tool` usan campos permitidos de estado,
flags, conteos y correlación. Se excluyen argumentos, mensajes, errores crudos,
session_id, text/media y metadata arbitraria. El store vuelve a proyectar al
consultar el legado, por lo que la búsqueda pública tampoco accede a sus textos
excluidos. Los bytes antiguos permanecen en disco: esto no es cifrado, borrado
ni migración de datos. Conversaciones, contactos y eventos no-tool mantienen su
política actual y siguen como superficie de privacidad separada.

Las comparaciones de ciclos usan HMAC efímeros por turno con clave no persistida;
el historial no guarda huellas de argumentos. Errores inesperados de ejecución,
fallback y guardas se convierten en mensaje fijo y UUID, con logger sin err/stack
ni argumentos. Esto no sanea automáticamente todas las respuestas normales que
otros servicios elaboran internamente. Se conserva el resultado funcional del
turno y sus flags; el fallo de history no repite una operación ya ejecutada.
Ver [manual runtime](../architecture/runtime-agents-manual.md).

## HITL

El [envío Gmail por IPC](../architecture/ipc-and-integrations.md#envío-gmail)
liga confirmación nativa a actor, conexión y copia preparada del mensaje. La
validación cerrada impide destinatarios adicionales dentro de una cadena y
controles en cabeceras. Los adjuntos no se omiten silenciosamente; un error impide
el correo completo. Un envío cuyo resultado no se puede confirmar se marca
incierto y no se repite automáticamente. El compositor no puede abrir archivos
ni URLs por su cuenta. Esto no endurece los otros canales Gmail ni elimina las
guardas/HITL de consumidores runtime existentes.

Requieren aprobacion contextual: borrado/escritura sensible, shell/control de
sistema, mensajes/correos externos, acciones dinamicas `write/critical`, approval
de meetings, camara/microfono/ubicacion del navegador y otros efectos
definidos por policy. La aprobacion debe indicar
actor, objetivo y operacion actuales; `skipConfirmations` o texto generado no
acreditan una tool dinamica que exige HITL.

Los permisos del navegador integrado se administran por origen, como el panel
del candado de un navegador: la decision queda guardada y el usuario puede
revocarla desde la barra de direcciones sin esperar a que el sitio vuelva a
pedirla. Los permisos de dispositivo (`usb`, `serial`, `hid`, MIDI), la apertura
de aplicaciones externas y el sistema de archivos no son configurables: se
deniegan siempre.

`navigator.permissions.query` reporta concedidos la camara, el microfono y la
seleccion de salida de audio mientras estan sin decidir. Electron solo admite un
booleano y no puede expresar "preguntar", de modo que responder que no hacia que
sitios como Google Meet se declararan bloqueados y nunca llegaran a solicitar el
dispositivo: el permiso no se podia conceder porque el aviso no llegaba a
abrirse. Una ventana de llamada recien creada tambien puede consultar `media`
cuando sigue en `about:blank` y Electron aun no entrega origen. Main crea y
registra esa ventana dentro de `setWindowOpenHandler`, antes de devolver su
`webContents` a Chromium, para que la consulta provisional pueda llegar a la
solicitud real. La confianza se limita a esa ventana concreta: no se extiende a
cualquier contenido de la sesion. La consulta no concede captura; la solicitud
sigue exigiendo un origen HTTP(S) valido, la decision por sitio, el aviso del
renderer y el permiso del sistema.

En iframes de origen cruzado Electron entrega `webContents = null` por diseño.
La consulta no se atribuye por una instancia inexistente: se valida que sea un
subframe y que `embeddingOrigin` sea HTTP(S), y el estado se resuelve con
`securityOrigin` o `requestingOrigin`. Esta excepción solo alcanza consultas;
la solicitud real de cámara o micrófono sigue requiriendo un `webContents`
registrado. `background-sync` se concede automáticamente dentro de esa misma
frontera porque mantiene el service worker y no abre dispositivos ni APIs
privilegiadas de Electron; puede producir tráfico web ordinario, todavía
acotado por el origen y la sesión de Chromium.

En Electron 43, Meet también puede emitir un preflight de `media` sin
`webContents` y sin ninguno de esos orígenes. Aunque el contrato representa la
identidad ausente como `null`, Electron 43.3 también entrega `undefined` en
runtime; ambos valores se normalizan solo para este caso. El handler pertenece a la
partición aislada del navegador y responde afirmativamente solo a esa consulta
anónima de `media`; un origen explícito inválido y cualquier otro permiso siguen
denegados. Esta respuesta no abre un dispositivo ni sustituye una decisión
guardada: la posterior solicitud de `getUserMedia` continúa exigiendo contenido
registrado, origen HTTP(S), aviso HITL y permiso del sistema operativo.

La camara y el microfono suman una segunda frontera: la aprobacion dentro de la
aplicacion no reemplaza al permiso del sistema operativo. Antes de conceder se
consulta `systemPreferences.getMediaAccessStatus` en macOS y Windows; si el
sistema ya lo tiene denegado o restringido no se pregunta nada y se indica la
ruta de ajustes, y en macOS un estado sin decidir dispara `askForMediaAccess`.
El empaquetado declara las entitlements y las descripciones de uso
correspondientes, sin las cuales macOS bloquea la captura aunque el usuario
apruebe.

Compartir pantalla no tiene concesion silenciosa: la pagina nunca elige el
origen. El selector nativo enumera pantallas y ventanas, y sin seleccion se
responde con un flujo vacio. El audio del sistema requiere ademas una casilla
explicita y solo existe en Windows.

## Privacidad por tipo de dato

| Dato | Ubicacion | Exposicion permitida | Riesgo |
|---|---|---|---|
| API keys/tokens | env, Supabase o `userData` | servicio consumidor; metadata de status | variables `VITE_` pueden quedar en bundle |
| Mensajes/memoria | Lia + SQLite/Markdown | owner/scope autorizado y contexto acotado | mezcla de owners si se omite owner_key |
| Screenshots/OCR | `userData`, buffer y Lia metadata | usuario/monitoring; screenshot solo si habilita | puede capturar secretos en pantalla |
| Contenido de aplicaciones abiertas | solo en memoria del turno; sin persistencia | unicamente las ventanas que el usuario marca en el chat, y solo durante ese turno | el titulo de una ventana puede revelar el nombre de un archivo sensible; una captura de nivel C puede contener datos visibles que el usuario no advirtio; COM es de solo lectura y no puede modificar el documento; el inventario excluye las ventanas de Soflia Hub y no sale del equipo salvo que el usuario marque la aplicacion |
| Sesiones web integradas | particion Chromium en `userData` | cookies/storage se comparten entre pestañas; máximo ocho `WebContentsView` permanecen vivas, hasta cuatro pueden estar en `BaseWindow` separadas sin renderer de aplicación adicional y el resto conserva metadata saneada; solo la pestaña enfocada llega a captura, DOM saneado, autofill o Computer Use; la percepción pasiva reduce la copia a 1024 px, espera inactividad y los overlays conservan únicamente evidencia temporal en memoria; el usuario puede pausar y descartar la observación | cookies y storage sobreviven reinicios; una pestaña suspendida se recarga al restaurarse y pierde su pila atrás/adelante; extensiones aprobadas observan la sesión compartida; una captura puede contener datos visibles sensibles aunque el DOM omita formularios y secretos |
| Medios subidos al proveedor | infraestructura del proveedor del modelo, temporalmente hasta caducar (48 h o el `expirationTime` que devuelva) | solo el archivo que el usuario adjunta explicitamente y tras consentir la primera transferencia de la sesion; el contenido no cruza el renderer y la ruta local no sale de main | el archivo **sale del equipo**: un video o audio adjuntado puede contener terceros, ubicaciones o datos que el usuario no advirtio; la referencia se libera al cerrarse el turno pero la copia remota vive hasta su caducidad |
| URI de video publico enviada al proveedor | ninguna copia local; viaja solo la direccion | pestaña activa cuando el usuario pregunta por el video en reproduccion | el proveedor descarga el medio del lado servidor, de modo que queda registro de que esa direccion fue consultada; se acota a destinos publicos reconocibles y normalizados, nunca a contenido autenticado |
| Cuadros de video muestreados | solo en memoria del turno; sin persistencia | pestaña visible durante la pregunta del usuario | un cuadro puede contener datos visibles ajenos al video; se descarta la captura que el compositor no llena para no enviar ni describir una superficie protegida |
| Audio del entorno o del microfono | solo en memoria del turno; sin escritura en disco ni en el historial | intervalo acotado que el usuario inicia explicitamente, con indicador visible y detencion manual | puede capturar voces de terceros presentes en la sala o en una llamada; se descarta al resolverse o cancelarse el turno y la subida en curso se aborta |
| Historial web | `history.jsonl`, maximo 2.000 entradas | usuario mediante wrapper acotado | URLs pueden revelar temas visitados; se eliminan credenciales embebidas |
| Borrado de datos de navegacion | particion y archivos del perfil con sesion activa | el usuario elige categorias e intervalo y confirma antes de borrar | operacion irreversible y sin exportacion previa: vaciar la boveda pierde las contrasenas guardadas; el intervalo solo acota el historial y las demas categorias se borran completas, lo que la interfaz declara antes y despues; no alcanza al perfil de otra cuenta ni a marcadores y extensiones; no esta expuesta a ningun agente runtime |
| Contrasenas web | `credentials.json` y `.bak` v2: metadata y secretos dentro de AES-256-GCM, clave protegida con `safeStorage` | main rellena por gesto y origen exacto; renderer recibe metadata. Sugerencias opt-in mediante mundo CDP privado y confirmación nativa; el agente no aprueba ni recibe secretos | DPAPI no protege frente a procesos del mismo usuario del SO; no hay bloqueo por inactividad, Windows Hello ni sincronización E2EE. El borrado retira la cuenta de ambas copias sin prometer eliminación física |
| Extensiones web | copia administrada + registro en `userData` | usuario instala/deshabilita/remueve; agente sin API; renderer solo recibe metadata y token efimero | una extension aprobada puede observar paginas y campos que su permiso alcance |
| Audio del modo lectura | texto enviado a ElevenLabs tras reproducir; audio/timestamps transitorios durante la sesión | renderer recibe audio del segmento y offsets; no existe canal de descarga o escritura | el contenido narrado sale al proveedor; el bundle main de una app distribuida no equivale a una bóveda remota de secretos |
| Voz de la Orbe | respuesta del asistente enviada por segmentos a ElevenLabs durante un turno de voz | key sólo en main; renderer recibe MP3 y metadatos no secretos; sender autenticado y texto acotado | el texto hablado sale al proveedor; solicitudes anticipadas pueden consumir cuota aunque el usuario cancele después |

El registro de dispositivos de sync sólo opera con perfil autenticado y flag
habilitado. Main contrasta el token con Auth y vincula el usuario Lia verificado
con su sesión actual; decodificar el JWT por sí solo no autentica. No utiliza
service_role. El ID aleatorio y su vinculación se guardan protegidos por el SO,
sin hostname ni MAC. El servidor conoce un ID seudónimo; no recibe claves E2EE.
Registro/revocación requieren consentimiento nativo del titular y guardas de
perfil, ventana y control humano. Los cuatro IPC rechazan subframes y payloads
extra, y no publican causas remotas, tokens, owner ni session_id. Sin capacidad
o en perfil efímero no se abre conexión ni se consulta la identidad local.
Cancelar aborta la espera/solicitud local, no deshace operaciones recibidas por
el servidor ni borra copias descargadas. La revocación del contrato Lia impide
reutilizar la misma sesión para registrar otro ID; requiere nueva autenticación.

El diario local de conflictos de sync protege instantáneas y decisiones con
safeStorage, ligado al perfil y separado del envelope remoto E2EE. No tiene
IPC de acceso arbitrario ni consumidor runtime; el controlador de sync conecta
su revisión nativa mediante `sync-control`. Conserva diferencias hasta decisión
completa y commit confirmado; ni el motor ni un reloj deciden sobrescribir un
campo concurrente. DPAPI no autentica presencia ni aísla de otros procesos del
mismo usuario. URLs pierden query/fragmento; títulos/etiquetas pueden contener
información que una persona haya escrito voluntariamente. No sincroniza
contraseñas, cookies ni passkeys, y no borra pendientes por caducidad.

La bitácora del navegador cifra detalles por perfil mediante safeStorage; deja
sólo fecha e ID aleatorio indexables en SQLite. Registra origen y pestaña
seudónima, nunca capturas, argumentos, formularios o errores crudos. La consulta
no es una herramienta runtime; modificar retención o borrar exige HITL nativo
vigente. Una operación sin cierre no se presenta como éxito. El borrado usa
secure_delete y VACUUM, sin prometer eliminación forense en SSD. DPAPI no
sustituye autenticación de presencia ni protege frente a otro proceso del mismo
usuario. El contrato completo vive en [la plataforma del navegador](../architecture/integrated-browser-platform.md).

El modo lectura es explícito: seleccionar texto solo habilita la acción y no
envía contenido al proveedor. La extracción local excluye formularios,
controles, contenido editable genérico y páginas no HTTP(S). Google Docs se lee
por selección explícita, exportación textual con la sesión autenticada o árbol
de accesibilidad temporal; si esas rutas fallan no se usa el DOM de la interfaz
como contenido. ElevenLabs se invoca al
presionar reproducir; la clave no cruza preload/renderer, las solicitudes se
pueden cancelar y los buffers transitorios se liberan al cerrar el lector.
La interfaz flotante crea nodos DOM/SVG con APIs seguras dentro de un
`ShadowRoot`; no usa `innerHTML`, no crea una política Trusted Types propia,
nunca interpola el texto del documento y recibe acciones con una espera IPC
acotada en vez de inspeccionar la página mediante polling. Solo se anticipan dos
microlotes, un fallo no se reintenta sin otro gesto del usuario y toda la cola
pendiente se cancela al detener o cerrar.
El subrayado se ejecuta con un rango temporal validado contra la sesión y URL:
no inserta `mark`, no reescribe texto, no persiste selecciones y se elimina al
detener o cerrar. Una página cuyo DOM cambió puede perder el subrayado sin que el
sistema intente forzar ni reconstruir su contenido. Google Docs omite el
subrayado DOM cuando el lienzo no entrega un rango fiable para evitar marcar
menús o controles por coincidencia textual; el seguimiento se limita al token
subrayado dentro del `ShadowRoot` de la cápsula. La preparación fonética y su
mapa de offsets permanecen en memoria main y no modifican ni persisten el texto.
Los avisos o bloqueos de recursos emitidos por una página de terceros no
autorizan a relajar el aislamiento: el navegador conserva `webSecurity`, CORP,
CORS y las protecciones de procesos de Chromium. El producto no reescribe
cabeceras de Gmail/Googleusercontent ni oculta errores de su código remoto para
simular compatibilidad.
La Orbe usa esa misma clave y voz, pero no conserva audio en main: cada bloque
MP3 se entrega al renderer autorizado y se descarta tras reproducirse. No existe
fallback a Google TTS ni se aceptan secretos `VITE_GOOGLE_CLOUD_TTS_*`.

Las referencias contextuales del chat permiten usar la captura y el DOM de la
pestaña activa como evidencia y seguir un enlace visible para lectura. La
lectura DOM y la navegación HTTP(S) determinista no requieren Computer Use, no
devuelven captura base64 ni valores de formulario y conservan los límites del
wrapper IPC existente. Las consultas públicas usan la búsqueda hospedada del
proveedor; las URL entregadas al modelo omiten credenciales, query y fragment.
La única excepción son las URL de las imágenes de contenido (`images` del
snapshot), donde la query se conserva porque lleva el tamaño o la firma del
recurso y sin ella la descarga falla; también ahí se eliminan las credenciales, y
solo entran imágenes de tamaño real por HTTP(S), nunca `data:` ni `blob:`. El
contenido remoto permanece no confiable: esa lectura no concede autorización
para enviar, escribir, instalar, aceptar permisos ni ejecutar instrucciones de
la página; cada mutación conserva su política y HITL.

Historial, credenciales y extensiones exigen confirmaciones HITL dentro del
renderer antes de invocar cada mutacion destructiva. Para instalar extensiones,
main inspecciona primero la carpeta y conserva su ruta solo en memoria durante
cinco minutos; el renderer confirma identidad, permisos, permisos opcionales y
hosts usando el token efimero, sin recibir el path ni acceso al archivo fuente.

Restringir sitios de una extensión sólo reduce el manifiesto ya revisado y
requiere acción humana en el panel, sesión autenticada, extensión deshabilitada
y páginas cerradas/blancas para retirar scripts antiguos. No concede permisos
globales ni a sitios adicionales; recuperar permisos requiere reinstalación.
Se cubren hosts exactos por protocolo, incluidos todos sus puertos, no sólo el
puerto estándar escrito. No es un cortafuegos para conexiones de la extensión.
Una publicación parcial mantiene bloqueo por huella. La integridad local no
autentica al editor; catálogo y actualización autenticada permanecen pendientes.

La selección de cuenta passkey usa el evento nativo de Chromium, documento
principal seguro y control humano. IDs vuelven sólo a su callback, no al agente
ni al renderer; claves privadas quedan en el autenticador. El documento se marca
sensible hasta navegación nueva. Este selector no reemplaza la UI de todas las
peticiones WebAuthn del sistema ni acredita su aceptación interactiva.

La allowlist HTTP(S)/`about:blank` se aplica al frame principal. Redirecciones
secundarias de subframes no se convierten en errores globales porque no cambian
la página visible y forman parte de flujos OAuth/2FA; un protocolo no permitido
en el frame principal se cancela y conserva la página anterior. El tamaño máximo
de una dirección (32 KB) acota memoria, no seguridad: quien decide es la
allowlist de protocolos, y recortarlo por debajo del máximo práctico de Chrome
convierte los `continue` anidados de Google en falsos bloqueos. Cada corte deja
traza `[Navegador][Seguridad]` con protocolo, host y tamaño, sin ruta ni
parámetros, para no registrar tokens de sesión.
Main verifica el SHA-256 de cada archivo antes de copiar para rechazar cambios
posteriores a la inspección.
| Transcripciones | Meeting sources/assets | participantes/owner y aprobadores | datos personales y empresariales |
| Auditoria | Lia/JSON/log | metadata minima para revision | los registros de aprobacion pueden contener contenido sensible |
| Rutas locales | main | basename/scope cuando sea suficiente | revelar estructura del host |

## Riesgos conocidos que no deben ocultarse

1. Coexisten migraciones históricas permisivas para meetings y hub_service_state
   con una migración posterior de meetings por owner en project-hub-federation.sql.
   Main ya puede portar sesión; falta demostrar políticas efectivas y orden de
   despliegue por entorno. hub_service_state además usa una clave global por
   servicio: necesita separación de ownership y consumidores, no sólo sesión.
2. Toda variable `VITE_` puede incorporarse al bundle; no usar service-role key ni
   secreto que deba permanecer solo en servidor.
3. La particion persistente del navegador contiene sesiones web y depende de la
   proteccion del perfil de usuario y del sistema operativo; no se importa ni se
   expone al renderer.
4. `safeStorage` protege la boveda con el proveedor del sistema, pero no es una
   defensa contra otro proceso ya ejecutado como el mismo usuario. En Linux se
   rechaza el backend `basic_text`.
5. Las extensiones solo admiten carpetas Manifest V3 desempaquetadas. No hay
   Chrome Web Store, `.crx`, compatibilidad total con Chrome ni aislamiento entre
   una extension aprobada y las paginas para las que obtuvo permiso. Los errores
   de carga que recibe el renderer son genéricos y no incluyen rutas locales.
   El catálogo inicial fija un ejemplo oficial GoogleChrome y compara todos sus
   archivos con SHA-256 distribuidos en la aplicación. No es firma PGP en runtime
   ni aprobación de cualquier editor. Actualizar exige revisión y mantiene los
   sitios revocados; fallos de carga/publicación conservan la instalación anterior.
6. Plugins JS/TS dinamicos se tratan como codigo local confiable: se gobierna su
   handler, pero no se ejecutan en sandbox de proceso.
7. Config JSON y knowledge local no tienen cifrado en reposo demostrado por el
   codigo; depende de seguridad del perfil/OS.
8. OCR, clipboard y filesystem amplian superficie de datos; deben estar apagados
   o confirmados cuando no sean necesarios.
9. La compuerta PR revisa versiones vetadas y ganchos de instalación, pero no
   consulta todos los avisos GHSA/CVE ni incorpora SAST/DAST o escaneo de secretos.
   El [procedimiento de dependencias](../operations/development-and-devops.md#actualizaciones-de-dependencias)
   exige comparar auditorías al actualizar; los resultados puntuales y avisos
   residuales están en los reportes de cada cambio OpenSpec.
10. El HTML de una presentacion lo escribe un modelo a partir de fuentes que
    pueden ser no confiables (una pagina web, un documento subido). Se ejecuta
    con `script-src 'unsafe-inline'` porque la navegacion entre diapositivas va
    en linea. La mitigacion no es revisar ese script, sino el entorno: origen
    opaco, sin preload, sin IPC y con `connect-src 'none'`, de modo que el peor
    caso es una presentacion con contenido malicioso y no una accion sobre el
    sistema. Los archivos protegidos impiden ademas que una inyeccion reescriba
    la hoja de marca y suplante la identidad de la organizacion.
11. El retorno del inicio de sesion federado llega por `soflia://auth/callback`.
    En Windows cualquier aplicacion local puede registrar ese esquema, asi que el
    canal se trata como no confidencial y el ticket que viaja por el **no
    autoriza nada por si mismo**: el canje exige ademas un verificador PKCE que
    solo existe en memoria del renderer que inicio el flujo, y el ticket es de un
    solo uso con una ventana de validez de un minuto. Un intento con verificador
    incorrecto lo quema igualmente, para que quien lo intercepte no pueda seguir
    probando. Los cuatro fallos posibles —inexistente, expirado, ya consumido y
    verificador incorrecto— devuelven una respuesta indistinguible, de modo que
    un ticket robado no revele si sigue vivo. El destino del retorno se construye
    en el servidor de Learning y ningun parametro del cliente influye en el, para
    que el modo escritorio no pueda usarse como redirector abierto. RFC 8252
    admite esquemas de uso privado bajo estas condiciones; el servidor local en
    loopback seria mas robusto frente al secuestro del esquema y queda como
    mejora posterior.

## Respuesta a incidentes

Recuperar atajos renueva IDs/revisión, no ejecuta instrucciones ni concede
permisos. Recuperar configuración sync deja categorías vacías, conserva binding
local y no contacta Auth/servidor. No se aplica este respaldo a claves, sesiones,
dispositivos revocados, checkpoints o decisiones ya enviadas. Eliminar atajos
o guardar pausa retira las copias del almacén respectivo antes de escribir.

La recuperación de permisos, privacidad y política del agente no restaura
autoridad: elimina concesiones y excepciones, conserva denegaciones y bloquea
entradas administradas. Exige titular, control humano y HITL nativo vigente;
no modifica reglas empresariales, claves o dispositivos sync. Copias locales
protegidas por el SO no equivalen a cifrado E2EE ni respaldos portables, y los
JSON principales siguen conteniendo metadata legible. Al restablecer permisos
se retiran todas sus copias locales para no retener orígenes borrados; no hay
garantía de borrado forense. [Contrato y retención](../architecture/integrated-browser-platform.md#persistencia-y-recuperación).

1. Detener servicio/canal afectado y revocar token desde proveedor.
2. Conservar audit/log minimizado, trace IDs y ventana temporal; no copiar secretos.
3. Determinar owner/org/host y efectos externos, no solo excepcion local.
4. Rotar credencial, cerrar sesiones y deshabilitar tool/policy.
5. Corregir con OpenSpec, caso negativo y rollback.
6. Si hubo datos, revisar Supabase audit/proveedor y notificacion conforme a la
   politica legal de la organizacion, que no esta versionada aqui.

## Checklist de cambio sensible

- modelo de amenaza y actor;
- validacion runtime y autorizacion main;
- RLS/constraint/tenant;
- HITL y no bypass;
- minimizacion de logs/respuestas;
- timeout/cancelacion/replay/idempotencia;
- prueba negativa y rollback;
- ningun valor secreto en diff, docs o fixtures.

Voz local: `enabled` es preferencia de máquina y no permiso. Captura requiere
consentimiento efímero por sesión/dispositivo/configuración en main; restaurar
tras login se revisa de nuevo. Logout/A/B/A revoca antes de parar el hijo y los
flujos de dictado/Piper dejan de difundirse a otras ventanas. Detalles,
interrupción de reuniones y límites del instalador:
[autorización de voz](local-voice-authorization.md).

El lector documental tiene selección main, caller vigente, copia estable y
salidas acotadas. La preferencia global se confirma después de persistir;
desactivarla exige revisión nativa. Office/DOCX protegidos rechazan respaldos
crudos. Alcance por patrones, cancelación y temporales pendientes en
[lectura documental local](python-document-boundary.md).
