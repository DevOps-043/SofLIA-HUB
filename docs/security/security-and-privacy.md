# Seguridad y privacidad

Estado: vigente. Actualizado: 2026-08-06.

<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: ai-specs/policies/tool-boundaries.md -->

## Activos protegidos

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
| Anuncio proactivo de la orbe | sin sesion iniciada no se muestra la orbe ni se locuta nada, y al cerrar sesion la cola pendiente se descarta; se muestra sin robar el foco | `electron/main/orb-announcements.ts` |
| Workspace de Skills | contencion por `realpath` (cierra el escape por enlace simbolico), rechazo de rutas absolutas y `..`, allowlist de extensiones, limites de tamano y archivos protegidos que el modelo no puede reescribir | `electron/skill-workspace/paths.ts`, `electron/skill-workspace/service.ts` |
| Render de presentaciones | protocolo local que solo sirve el workspace indicado, CSP sin `connect-src`, `iframe` con `sandbox="allow-scripts"` sin `allow-same-origin` y vista nativa sin preload en particion propia | `electron/skill-workspace/protocol.ts`, `electron/skill-workspace/presentation-view.ts` |
| Branding | solo columnas de presentacion, descarga restringida al host de Supabase SOFIA con limite de tamano y timeout, colores validados antes de entrar al CSS | `electron/organization-branding/` |
| Handlers | payloads serializables y servicios por dominio | `electron/*-handlers.ts` |
| Canales | principal, rol, scope y capabilities | `electron/communication-hub/authorization.ts` |
| WhatsApp | normalizacion, allowlists, politica de grupo y tools bloqueadas | `electron/whatsapp/security.ts`, `electron/wa-agent/tool-declarations.ts` |
| Tools dinamicas | contrato cerrado, agent/group/HITL, timeout, fingerprint, audit | `electron/mcp-manager/` |
| Comandos | longitud, patrones/sandbox y confirmacion | `electron/security/command-policy.ts`, `electron/whatsapp-remote-hub/` |
| Datos | constraints, indices y RLS | `database/` |
| Release | secrets solo Actions, token validado y permisos `contents: read` | `.github/workflows/release.yml` |

## HITL

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
| Contenido de aplicaciones abiertas | solo en memoria del turno; sin persistencia | unicamente las ventanas que el usuario marca en el chat, y solo durante ese turno | el titulo de una ventana puede revelar el nombre de un archivo sensible; una captura de nivel C puede contener datos visibles que el usuario no advirtio; COM es de solo lectura y no puede modificar el documento; el inventario excluye las ventanas de Pulse Hub y no sale del equipo salvo que el usuario marque la aplicacion |
| Sesiones web integradas | particion Chromium en `userData` | cookies/storage se comparten entre pestañas; máximo ocho `WebContentsView` permanecen vivas, hasta cuatro pueden estar en `BaseWindow` separadas sin renderer de aplicación adicional y el resto conserva metadata saneada; solo la pestaña enfocada llega a captura, DOM saneado, autofill o Computer Use; la percepción pasiva reduce la copia a 1024 px, espera inactividad y los overlays conservan únicamente evidencia temporal en memoria; el usuario puede pausar y descartar la observación | cookies y storage sobreviven reinicios; una pestaña suspendida se recarga al restaurarse y pierde su pila atrás/adelante; extensiones aprobadas observan la sesión compartida; una captura puede contener datos visibles sensibles aunque el DOM omita formularios y secretos |
| Historial web | `history.jsonl`, maximo 2.000 entradas | usuario mediante wrapper acotado | URLs pueden revelar temas visitados; se eliminan credenciales embebidas |
| Borrado de datos de navegacion | particion y archivos del perfil con sesion activa | el usuario elige categorias e intervalo y confirma antes de borrar | operacion irreversible y sin exportacion previa: vaciar la boveda pierde las contrasenas guardadas; el intervalo solo acota el historial y las demas categorias se borran completas, lo que la interfaz declara antes y despues; no alcanza al perfil de otra cuenta ni a marcadores y extensiones; no esta expuesta a ningun agente runtime |
| Contrasenas web | `credentials.json`, secreto cifrado con `safeStorage` | main rellena por gesto y origen exacto; renderer recibe metadata | un proceso del mismo usuario puede heredar la frontera del sistema operativo |
| Extensiones web | copia administrada + registro en `userData` | usuario instala/deshabilita/remueve; agente sin API; renderer solo recibe metadata y token efimero | una extension aprobada puede observar paginas y campos que su permiso alcance |
| Audio del modo lectura | texto enviado a ElevenLabs tras reproducir; audio/timestamps transitorios durante la sesión | renderer recibe audio del segmento y offsets; no existe canal de descarga o escritura | el contenido narrado sale al proveedor; el bundle main de una app distribuida no equivale a una bóveda remota de secretos |
| Voz de la Orbe | respuesta del asistente enviada por segmentos a ElevenLabs durante un turno de voz | key sólo en main; renderer recibe MP3 y metadatos no secretos; sender autenticado y texto acotado | el texto hablado sale al proveedor; solicitudes anticipadas pueden consumir cuota aunque el usuario cancele después |

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

1. Meetings y `hub_service_state` tienen RLS permisivo para anon y dependen
   del aislamiento de aplicacion. Es la brecha de seguridad de datos prioritaria.
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
6. Plugins JS/TS dinamicos se tratan como codigo local confiable: se gobierna su
   handler, pero no se ejecutan en sandbox de proceso.
7. Config JSON y knowledge local no tienen cifrado en reposo demostrado por el
   codigo; depende de seguridad del perfil/OS.
8. OCR, clipboard y filesystem amplian superficie de datos; deben estar apagados
   o confirmados cuando no sean necesarios.
9. No hay SAST/DAST, escaneo de secretos ni audit de dependencias en la compuerta
   PR actual; el reporte base registra vulnerabilidades conocidas.
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
