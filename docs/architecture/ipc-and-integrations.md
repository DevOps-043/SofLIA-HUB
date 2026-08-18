# IPC e integraciones externas

Estado: vigente. Actualizado: 2026-08-06.

<!-- evidence: electron/preload/channels.ts -->
<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/service-ipc.ts -->

## Contrato IPC

La allowlist actual contiene 338 canales derivados de cinco arrays: 80, 52, 61,
104 y 41. El numero es verificable en `electron/preload/channel-group-*.ts`; si cambia,
el catalogo y su validador deben actualizarse juntos.

| Namespace | Canales | Proposito |
|---|---:|---|
| `computer` | 33 | archivos, comandos, procesos, portapapeles, email, tema/sidebar |
| `desktop-agent` | 23 | tareas, abort, config, UI input, ventanas, screenshot, calibracion |
| `calendar` | 17 | OAuth, conexiones, eventos, polling y eventos de trabajo |
| `memory` | 14 | contexto, facts y skills |
| `orb` | 15 | dictado, TTS, apertura y ventana flotante |
| `monitoring`, `gmail`, `remote-node` | 13 cada uno | actividad; correo; host remoto |
| `meeting`, `whatsapp` | 12 cada uno | runs/approvals/sync; conexion/config/status |
| `meeting-live` | 11 | audio, segmentos, deteccion y estado live |
| `channels` | 10 | hub multicanal (WhatsApp y Telegram) |
| `passive-skills` | 3 | consulta, alta y baja de Skills pasivas |
| `integrated-browser` | 47 | navegación, pestañas, composición, captura visible, percepción, modo lectura, controlador determinista, viewport, visibilidad, eventos, historial, credenciales, extensiones y borrado de datos de navegación |
| `desktop-context` | 2 | inventario de ventanas abiertas y extraccion en cascada del contenido de las que el usuario marca en el chat |
| `skill-workspace` | 13 | espacio de trabajo de Skills: crear, estado, leer, escribir, editar, borrar, guardar y descargar imagenes, abrir carpeta, progreso y URL de vista previa |
| `presentation`, `presentation-view` | 5 | vista a pantalla completa, exportacion a HTML autocontenido y preparacion de la identidad de marca |
| otros | 56 | voice, updater, automation, drive, pytools, telegram, gchat, app, background-host, root y AI |

### Recorrido obligatorio

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

`integrated-browser:tab-reorder` reordena las pestañas al arrastrarlas. El
handler y el método de preload ya existían, pero el canal **faltaba en la
allowlist**: `validateChannel` lanza de forma síncrona, y como la llamada vivía
dentro de un updater de estado de React, el error se propagaba por la fase de
render y dejaba la aplicación en blanco. El arrastre usa Pointer Events con
captura —el gesto no se pierde al salir de la pestaña ni compite con la región
de arrastre de la ventana— y el reordenamiento se calcula fuera del updater.

`electron/integrated-browser-handlers.ts` registra cuarenta y dos operaciones invocables:
veintitrés de estado, navegación, pestañas, composición, viewport, captura,
percepción, controlador determinista y herramientas de desarrollo; siete del
modo lectura, dos de historial, cuatro de credenciales, cinco de extensiones y
una del panel de redacción.
Dos canales adicionales entregan estado y solicitudes de
apertura del agente al renderer, y otros dos entregan las acciones sobre el
texto seleccionado: la seleccion convertida en peticion para el chat y la
apertura del modo lectura. `electron/preload/integrated-browser-api.ts` y
`src/services/integrated-browser-service.ts` son las capas publicas.

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
captura visual reducida a 1024 px en su lado mayor y codificada en JPEG, con
cadencia base de diez segundos, y la difiere cuatro segundos después de
interacción, navegación o resize sin ejecutar DOM. En YouTube la cadencia es de
treinta segundos y la calma de doce para dejar terminar transcripciones y
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
persistente y conserva como máximo ocho `WebContentsView` vivas mediante LRU.
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
`hide`; al cerrarlos republican el viewport. Una tarea dirigida a esta vista
falla cerrado y nunca cambia silenciosamente al backend desktop.

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
accesibilidad. El inventario excluye las ventanas del propio Pulse Hub y solo
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
| Supabase IRIS | renderer/main proyecto | `VITE_IRIS_SUPABASE_*` | Project Hub degradado |
| Google OAuth/APIs | Calendar auth compartido | `VITE_GOOGLE_OAUTH_CLIENT_ID/SECRET` | conexion por usuario, refresh y desconexion |
| Microsoft Calendar | MSAL/Graph | `VITE_MICROSOFT_CLIENT_ID` | conexion separada por provider |
| ElevenLabs | REST binario y `with-timestamps` desde main | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; default `eleven_turbo_v2_5`, formato opcional | Orbe conserva texto sin voz; lector visual disponible; errores saneados de permiso, cuota o timeout |
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

- Variables `VITE_` quedan incrustadas por Vite incluso para main; no deben
  considerarse secretos de backend. Las claves anon publicas de Supabase dependen
  de RLS; credenciales privilegiadas no deben usar este mecanismo.
- OAuth tokens no se documentan ni se envian al renderer salvo metadata segura.
- No existe garantia de disponibilidad de terceros; cada UI debe soportar no
  configurado, desconectado, rate limit y timeout.
- `docs/contracts/openapi.json` no enumera IPC y no debe usarse como allowlist.
