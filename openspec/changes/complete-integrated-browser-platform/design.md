## Context

El navegador actual usa \`WebContentsView\` con una partición persistente por usuario, stores locales separados, ocho vistas vivas, hasta 500 pestañas lógicas y un agente que combina DOM, CDP y Computer Use. Los contratos básicos de historial, credenciales, extensiones, permisos, lectura y borrado ya existen, pero varios stores y controles permanecen aislados y el motor está fijado a una beta de Electron. Véase \`proposal.md\`.

Electron no ofrece paridad con Chrome ni compatibilidad completa de extensiones. El diseño conserva el navegador como superficie de trabajo de Pulse Hub, con contenido remoto sin Node, sandbox, aislamiento de contexto, permisos denegados por defecto y contratos IPC de cuatro capas.

## Goals / Non-Goals

### Decisiones implementadas al 2026-09-11

Voz reutiliza Orbe y el supervisor con un comando cerrado, prefijo literal,
recibos vigentes y confirmación nativa para reanudar. Memoria opt-in usa embeddings
de Google sólo sobre metadata saneada, SQLite cifrado por perfil, cuotas y
borrado separado; no envía páginas ni sincroniza. Una sonda local conservadora
exige handoff de formularios sensibles, sin botón de aprobación y sin atribuirle
cobertura universal de datos arbitrarios ni de capturas desktop.

La bóveda agrega verificación Windows ligada a HWND y lease revocable de cinco
minutos; nunca recibe PIN/biometría. SPA sin submit y SSO previo a revisión
mantienen el origen inicial, no la pertenencia del sitio de destino.
El zoom en Electron 43 usa emulación de viewport desktop por WebContents
con base Chromium uno, adaptación al resize y transformación de puntos DOM,
sin separar cookies ni alterar UA. Estas decisiones no añaden tablas remotas.

**Goals:**

- Entregar capacidades en fases activables y reversibles sin dejar IPC o stores parciales.
- Mantener secretos exclusivamente en main y separar perfil, organización y modo privado.
- Reutilizar los límites, stores y UI actuales antes de agregar nuevas dependencias.
- Hacer verificables privacidad, gobierno del agente, migraciones y diagnóstico.

**Non-Goals:**

- Reemplazar Electron por un fork de Chromium dentro de este cambio.
- Emular Chrome Web Store, sincronizar cookies o entregar credenciales al agente.
- Depender de un proveedor remoto para que la navegación básica funcione.

## Decisions

### Instalador Windows y Python privado

La ampliación solicitada usa una bienvenida propia NSIS con arte Pulse Hub y
controles nativos accesibles; conserva las páginas de ubicación, progreso real,
elevación, actualización y desinstalación de electron-builder. No modifica
Python del sistema ni cambia el navegador predeterminado. Python se prepara en
staging con digest oficial fijado, lock exclusivo y validación de las librerías
de ambos sidecars antes de promoverlo. Se conserva el runtime previo como respaldo.
El smoke de empaquetado usa fuentes sin .env y publicación deshabilitada; no
ejecuta el instalador. Véase [contexto del instalador](context-installer.md).

### Entrega por fases dentro de un contrato común

El cambio se implementa en cuatro fases: fundamentos P0, datos P1, privacidad/agente P2 y sincronización/empresa P3. Cada fase termina con pruebas, documentación y feature flags; no se cablea una UI hasta completar servicio, handler, allowlist, preload y wrapper.

Alternativa descartada: un refactor total del servicio actual. Aumentaría el radio de regresión sobre sesiones autenticadas y Computer Use.

### Servicios main pequeños alrededor de la sesión

Descargas, búsqueda/zoom/impresión, sesión de pestañas, marcadores, perfiles, protección y auditoría se implementan como servicios cohesionados que reciben la \`Session\` o el \`WebContents\` activo. \`IntegratedBrowserService\` coordina, pero no absorbe persistencia ni reglas nuevas.

### Stores versionados por perfil y migración copy-on-write

Los datos viven bajo el scope de perfil actual. Marcadores e historial usan stores main versionados; la primera apertura importa preferencias/JSONL legacy mediante archivo temporal y rename. Los modos privado e invitado usan particiones no persistentes y stores temporales en disco. Una cola de lifecycle captura el perfil saliente y drena sus stores antes de purgar cookies, caché y su directorio al cambiar de perfil o cerrar realmente la ventana. Aprobar la salida no purga: `beforeunload` puede cancelarla conservando la sesión. `will-quit` impide terminar el proceso hasta completar la limpieza, con reintento, vuelta a la aplicación o salida incompleta explícita si falla. Reabrir espera esa misma barrera; al terminar se invalidan cachés y snapshots para impedir resurrección de datos. Un cierre forzado o apagado puede dejar temporales; las descargas no se borran. Cambiar de perfil requiere confirmación nativa con cancelar por omisión; cerrar sesión real revoca la cuenta a la que el selector podía volver.

SQLite se usa cuando la consulta requiere índice o relaciones —historial, búsqueda semántica y auditoría— y JSON pequeño para ajustes, grupos y políticas. No se incorpora una abstracción genérica de repositorios.

### Importación HTML de marcadores en dos pasos

La selección de archivo no implica autorización para modificar la biblioteca.
Main lee de forma acotada el HTML elegido y prepara una revisión inmutable con
conteos, límite de 5000 marcadores y huella del estado de destino. El diálogo
nativo ofrece importar sólo nuevos, cancelar (default) o actualizar conflictos
de metadata. No muestra rutas, títulos ni URLs del archivo. La revisión vive
sólo en main, caduca a los cinco minutos y se consume una vez; no se crea un IPC
de escritura sin confirmación. Antes del commit se revalidan perfil, ventana y
huella bajo la cola del archivo. El resumen al renderer distingue nuevos,
actualizados, duplicados e inválidos; un fallo de E/S nunca produce éxito parcial.
Este bloque de 4.6 cubre marcadores HTML, historial JSON/JSONL y credenciales
JSON; el historial admite además el timestamp `last_visit_time` de Chromium,
sin acceso automático a perfiles de otros navegadores. Todos los formatos pasan
por selector, resumen y confirmación nativos antes de escribir.

### La bóveda conserva una frontera sin lectura

La referencia solicitada de Proton Pass motiva proteger también metadata.
La instantánea local v2 cifra el JSON completo con AES-256-GCM, clave aleatoria
por escritura protegida con `safeStorage` y nonce nuevo; autentica versión y
ámbito estable del archivo/perfil. La contraseña individual conserva su
protección previa del SO. No se comparte clave ni se sincroniza la bóveda:
esto es cifrado local, no E2EE ni resistencia a procesos del mismo usuario.
Las lecturas participan en la cola por archivo. La primera lectura v1 migra
sin cambiar IDs/fechas; antes del reemplazo se conserva un respaldo también
cifrado. Errores, autenticación fallida o formatos futuros no se interpretan
como una bóveda vacía, ni se restaura automáticamente un respaldo potencialmente
obsoleto. Las versiones anteriores de la aplicación rechazan v2; no se rebaja
el archivo ni se escribe metadata legible para permitir downgrade.

La recuperación explícita admite principal ausente o corrupto, con respaldo
cifrado compatible, no principal válido/versiones futuras ni errores de E/S.
Valida el sobre y cada secreto interno; no publica detalles por IPC. Al reemplazar
un principal dañado conserva primero sus bytes dentro de una copia safeStorage
ligada al ámbito, máximo cinco copias y sin purga automática. Revalida los bytes
exactos y el contexto bajo cola antes de rename; principal ausente usa publicación
exclusiva por enlace. No hay bloqueo multiproceso. El borrado de contraseñas
retira completas estas copias con advertencia, antes de escribir el principal
depurado; un fallo puede dejar limpieza parcial de copias y no anuncia éxito.

La bóveda extiende metadata y operaciones de salud, generación, importación y passkeys, pero la API renderer nunca obtiene una contraseña. Importar y exportar se ejecuta en main con diálogo del sistema; exportar requiere autenticación y advertencia, y genera un archivo elegido por el usuario. El agente sólo puede pedir handoff.

El guardado manual recibe el origen que mostró el gestor; main comprueba que
coincida con el sitio activo. La revisión main-only cifra el valor antes de la
confirmación y enlaza el commit de un solo uso con la huella de la bóveda y un
plazo de cinco minutos. Reemplazar una cuenta requiere un diálogo nativo con
cancelar por omisión. IDs ajenos o ausentes no crean cuentas de reemplazo y
renombrar hacia otra cuenta existente se rechaza. Una cola por archivo evita
perder cambios entre instancias del store. La UI actualiza con una contraseña
nueva en blanco, sin recuperar el secreto anterior. Este flujo manual no
sustituye la verificación del SO.

El guardado sugerido es opt-in, con preferencia cifrada por perfil y confirmación
nativa al activarlo. Un observador CDP independiente usa un mundo con nombre
privado, no el del agente ni el DOM principal. Sólo acepta el contexto del marco
principal, origen exacto y un submit precedido por clic/Enter confiable; no lee
campos mientras se escribe. Se excluyen HTTP remoto, iframes, formularios
ambiguos y acciones hacia otro origen. Main cifra el candidato antes de esperar
350 ms y muestra un diálogo de guardar/actualizar; no presume éxito del login.
La cuenta sin cambios no genera aviso. Cambiar perfil, control, pestaña, origen
o preferencia invalida la revisión. El secreto nunca se publica por consola,
IPC del renderer ni herramientas runtime. Desactivar desmonta scripts, bindings
y listeners; DevTools no se disputa y no hay fallback al mundo principal.
Quedan fuera SSO entre orígenes, formularios sin submit y marcos secundarios;
para ellos permanece disponible el guardado manual. El aviso no equivale a
Windows Hello, bloqueo de la bóveda ni sincronización E2EE.

### Persistencia remota de sync: contrato Lia aditivo

La tarea 7.1 prepara SQL local; no aplica cambios remotos ni activa sync. El
propietario es el UUID de Supabase Auth Lia, como `profiles`/`conversations`,
no un UUID SOFIA declarado por el cliente. Una sesión Lia verificable es
precondición; exige claim firmado `is_anonymous: false`, no sólo el rol
authenticated. No se hereda la política permisiva de `hub_service_state`.

Tres tablas nuevas separan dispositivos, última instantánea cifrada por categoría
y recibos de idempotencia. Cada dispositivo usa un UUID aleatorio y queda ligado
al `session_id` firmado del JWT y a una fila vigente de `auth.sessions`; no usa
hostname, MAC, correo ni claves de descifrado. Una sesión revocada no puede
registrarse de nuevo bajo otro ID. Reautenticar crea una sesión nueva y requiere
una nueva activación en el cliente futuro. RLS sólo permite SELECT propio desde
una sesión activa; las mutaciones se realizan por RPC cerradas con `search_path`
vacío, comprobación de propietario/sesión y bloqueo transaccional por usuario.
No se expone lectura de `auth.sessions` al cliente.

`put` exige categoría permitida, envelope v1 compatible con `BrowserSyncCrypto`,
revisión base, UUID de idempotencia y `trace_id`. Repetir exactamente devuelve la
revisión original, reutilizar la clave con otro contenido se rechaza, y una base
obsoleta devuelve conflicto sin sobrescribir. La revocación se serializa con las
escrituras del propietario. El contrato no resuelve conflictos en el cliente,
no destruye copias ya descargadas y no puede demostrar que un ciphertext opaco
contiene datos no secretos: el cliente valida antes de cifrar (7.7).

Cuotas iniciales: cuatro categorías de hasta 2 MiB cada una, 100 registros de
dispositivo por cuenta y 10.000 recibos de mutación. Alcanzarlas falla cerrado,
sin purga automática que invalide revocación/idempotencia. La retención y el
desbloqueo operativo de esas cuotas deben definirse antes del rollout. El
rollback operativo revoca acceso a objetos nuevos y conserva ciphertext; no
borra datos. La verificación usa PostgreSQL local desechable, no Lia real.

### Protección de red con reglas compiladas y proveedor opcional

La primera capa usa listas versionadas y verificadas para clasificar solicitudes, parámetros y descargas. El usuario controla niveles y excepciones por origen. Un proveedor de reputación remoto se integra detrás de un contrato con timeout y degradación; ninguna falta de respuesta se interpreta como seguridad.

Alternativa descartada: interceptores de extensiones de terceros sin revisión. Darían código y permisos de red a una frontera crítica.

El proveedor de reputación clasifica solicitudes HTTP(S) gobernadas de perfiles
autenticados: navegación, redirecciones, marcos, ventanas hijas y descargas.
No recibe IPs literales, nombres locales conocidos ni destinos de perfiles
efímeros. No hay resolución DNS para identificar intranets con nombre público.
La operación completa (cabeceras y cuerpo) tiene plazo de 1 s, hasta 5 s en
pruebas, y cuerpo máximo de 4 KiB. No sigue redirecciones ni acepta credenciales
en el endpoint. Mensajes locales cerrados sustituyen texto arbitrario remoto;
la clasificación remota no rebaja advertencias locales. La capa local de sesión
protege redirecciones, marcos, restauración y descargas aunque los flags estén
apagados. La barra muestra advertencia, último intento bloqueado y degradación
por pestaña mediante el estado existente, sin afirmar que el destino sea seguro.
El dictamen no se persiste ni se hereda entre documentos; respuestas obsoletas
no publican avisos. La revisión de solicitudes tiene máximo 32 consultas
pendientes, cancela contextos sustituidos y degrada a las guardas locales ante
indisponibilidad. Intersticiales main aislados cubren pestañas y ventanas nativas,
sin JavaScript, Node, preload ni red. Sólo cerrar o abrir en blanco, sin bypass;
no se permite al agente leer la página cubierta por un bloqueo vigente.
Certificados válidos conservan la verificación Chromium
(`-3`); errores se rechazan (`-2`) y nunca se usa el bypass `0`.

Las extensiones se cargan únicamente en sesiones persistentes autenticadas,
siempre con `allowFileAccess: false`. Tokens y operaciones fijan directorio,
generación de perfil y ventana. La cola nunca resuelve el directorio de destino
después de esperar E/S. Un cambio descarga extensiones activas e invalida cargas
tardías incluso en un recorrido A→B→A; una carga nueva se retira si falla guardar
el registro. El registro v1 conserva una huella del inventario (nombre relativo,
tamaño y SHA-256) aprobado. Cada carga y habilitación verifica de nuevo; una
extensión activa intacta no se recarga innecesariamente. Cambios o ausencia de
huella bloquean la carga y requieren reinstalación explícita; no se aprueba
automáticamente una instalación legacy. No es firma del editor, monitor continuo
ni aislamiento de escritores externos. Se acotan directorios/profundidad y se
rechaza exceso de instalaciones sin truncar registros.

La restricción por sitio recompila sólo una intersección del manifiesto aprobado.
Se limita a MV3 storage/scripting, sin APIs globales ni permisos opcionales; los
scripts estáticos no heredan marcos about:blank/data:. Los sitios representan
dominio y esquema exactos con todos sus puertos (no aislamiento de origen por
puerto). Exige deshabilitar y cerrar las páginas antes para retirar scripts
antiguos. No concede sitios retirados: recuperarlos requiere reinstalación
revisada. La nueva huella se publica con el registro; si la segunda escritura
falla, el estado parcial no carga por discrepancia de integridad. No hay
rollback automático que amplíe permisos. La elección del usuario «cualquiera»
permite escoger candidatos, no considerar confiable código arbitrario.

El catálogo inicial fija Reading Time del repositorio oficial GoogleChrome a
un commit y siete huellas SHA-256. La raíz de confianza se distribuye con la app;
la carpeta del usuario no puede declararse confiable. No hay PGP en runtime ni
descargas automáticas: UI muestra fuente/revisión y abre selección nativa.
La revisión usa el token de instalación de cinco minutos, ligado a sesión,
titular, ventana, perfil y control humano. Actualización explícita requiere
deshabilitar y páginas en blanco, prepara otra copia, conserva restricciones,
valida/carga y reemplaza el registro atómicamente antes de retirar la copia
anterior. Fallos de carga/publicación o cambios concurrentes conservan la anterior.
Una interrupción después del commit puede dejar un huérfano inactivo. Nuevos
paquetes/revisiones requieren revisar código, licencia y pines en la aplicación;
no se usa la versión autoafirmada de un manifiesto como prueba de autenticidad.

Passkeys conservan WebAuthn y proveedores de Chromium/SO. Main sólo atiende el
evento de selección de cuenta con diálogo nativo, cancelación predeterminada,
plazo y guardas de sesión/documento/control. Marca identidad sensible y no
transfiere claves ni IDs al renderer. No implementa autenticadores en JavaScript
ni pretende interceptar las demás UI nativas de WebAuthn; aceptación interactiva
Windows y llave física siguen en 9.5.

### Gobierno del agente previo a observación

La política por origen se evalúa antes de DOM, captura o acción. Estricto pregunta siempre al primer acceso; equilibrado permite lectura en sitios no sensibles y exige aprobación para acción o sitio desconocido. Las listas administradas prevalecen. La toma de control cancela el \`AbortSignal\`, detiene capturas y preserva un outcome real.

La auditoría guarda hashes y metadatos saneados; las capturas son opt-in, cifradas localmente, acotadas por retención y eliminables.

El driver visual mantiene dos comprobaciones main-only: una fija pestaña, vista,
ventana, generación de perfil, revisión de foco, política y control durante la
tarea; la otra fija URL y revisión visual de la captura usada para decidir.
Salir de la pestaña y volver no rehabilita una tarea. La comprobación de
identidad no concede permiso: la evaluación por origen sigue precediendo DOM,
captura, documento y acción. La navegación revalida después de cargar políticas
y antes de emitir `loadURL`. Se vuelve a comprobar después del marcado SoM y
de cada espera nativa, y el contexto nunca mezcla un DOM anterior con la URL
actual. Un contexto invalidado termina el loop como bloqueado, sin reintento
automático en otro destino.

El loop transmite `AbortSignal` opcional al driver. Autorizar y esperar son
cancelables; una captura o `insertText` ya emitidos no se pueden deshacer, pero
sus resultados no provocan otra acción, Enter ni petición al modelo después
de cancelar. No se propaga un motivo arbitrario de cancelación. Este contrato
no garantiza cancelar cómputo remoto. El registro CU posterior enlaza aborto
general/específico, apertura, viewport y SDK; la UI de pausa/toma de control
ya está implementada en 6.4 y su smoke de producto permanece en 9.5.

### Adjuntos de pestañas con evidencia acotada

El compositor usa `@` y el menú existente, con filtro local, teclado y máximo
ocho pestañas. El listado no lee DOM; cada selección conserva revisión de perfil
y un token aleatorio de documento. Main renueva el token al crear una vista,
iniciar navegación principal y navegar, incluso dentro de la página. Los
canales existentes exigen marco principal y payload cerrado. El recibo sólo
comprueba vigencia; no sustituye la política `observe-dom`.

La preparación serial tiene plazo total de quince segundos para pestañas y
rechaza todo el lote ante lectura vacía, fallo o cambio. Revalida el inventario
al terminar; detener o cambiar contexto descarta resultados sin afirmar que
canceló una operación nativa ya emitida. Main limita a 3000 caracteres por
pestaña antes de IPC. Renderer divide en hasta tres extractos de 1000 caracteres,
acota el bloque serializado a 60.000 y descuenta su tamaño del presupuesto
compartido de adjuntos. No promete lectura semántica completa de lienzos/PDFs.

El modo `attached-fragments` desactiva observación implícita, búsqueda web y
retrieval hospedado en ambos proveedores. Mantiene sólo herramientas del
workspace de la Skill elegida, excluyendo descarga de imágenes; el dispatcher
también aplica este límite. No se amplía una fuente por una instrucción dentro
de sus datos. El historial/memoria no son evidencia sobre las páginas.

Las fuentes se conservan en `metadata.sources`, sin nueva tabla, y muestran
extracto, URL sin query/fragmento/credenciales y fecha de captura. Regenerar usa
esos fragmentos históricos. Editar un mensaje inicia un turno nuevo sin adjuntos
anteriores. La UI distingue datos proporcionados de citas realmente emitidas,
advierte sobre referencias ausentes/inexistentes y no certifica la corrección
semántica de una conclusión. No consulta favicons externos. Estos extractos
heredan persistencia y acceso del chat (incluido compartirlo); no son la bitácora
cifrada ni un índice privado del navegador. El selector advierte este efecto.

### Atajos de lectura con permisos cerrados

Los atajos de 6.7 son instrucciones de lectura, no macros de acciones. Guardan
nombre, instrucción y los literales `selected-tabs` / `read-fragments`, nunca
contenido de página o concesiones de sitio. Un archivo v1 protegido por el SO
separa perfiles persistentes; cuota de 50, revisión optimista y cola asíncrona
por archivo evitan pérdidas concurrentes dentro de main. Eliminar requiere revisión
nativa y retira todas las copias locales de recuperación con advertencia.
Recuperación HITL desde soporte conserva instrucciones, renueva IDs/revisión y
no ejecuta nada; corrupción/futuras/incompatibilidad de ámbito se distinguen.
No ofrece sync ni exclusión multiproceso. El compositor prepara un borrador sin enviarlo,
exige pestañas frescas y bloquea fuentes/capacidades adicionales. Es una
superficie de UI humana bajo `agentGovernance`, no una herramienta runtime.

### Bitácora de operaciones cifrada por perfil

SQLite v1 conserva ID aleatorio y fecha indexados, con todos los detalles
protegidos por safeStorage y ligados al perfil. Una traza agrupa operaciones
anidadas DOM/documento/Computer Use y decisiones de política; nunca almacena
valores de entrada, resultados textuales, errores crudos ni capturas. El origen
excluye ruta, query, fragmento y credenciales; la pestaña usa hash seudónimo.
Registro opt-in bajo agentGovernance: si no se puede registrar el inicio no se
ejecuta la operación; un cierre de contexto no recrea el perfil purgado al
terminar. Inicio sin cierre significa interrupción, no éxito del objetivo.

La UI consulta explícitamente páginas de 50; máximo 5.000 eventos y 16 MiB.
Retención 7/30/90 días, 30 por defecto, aplicada al leer/escribir. Modificarla o
borrar requiere confirmación nativa de cinco minutos, contexto y control humano
vigentes, sin diálogos concurrentes. El IPC cerrado no admite fabricar eventos.
SQLite se abre/cierra sin colas pendientes; borrar usa secure_delete y VACUUM,
sin prometer eliminación forense ni aislamiento de otros procesos del usuario.

### Sync E2EE selectivo sobre Lia

El transporte usa la sesión Lia existente en main, con claims de forma válida,
rol authenticated e is_anonymous false; contrasta el usuario mediante Auth.
Decodificar JWT no sustituye verificar su firma. Auth/RPC autorizan en servidor;
no se crea login ni cliente service_role. Fetch específico conserva AbortSignal:
HTTPS cerrado, sin redirects/cookies/cuerpos de error expuestos; tres intentos
para red/429/5xx, backoff 250/750 ms, 20 s por petición y 45 s por operación.
Escrituras repetidas conservan cuerpo, idempotency_key y trace_id.

El dispositivo usa UUID aleatorio por sesión Auth en `sync-device.json`, con
owner/sesión/origen/ámbito protegidos por safeStorage. Se persiste antes de
registrar, sin hostname/MAC. Registro/revocación exige confirmación nativa,
contexto vigente y agente sin control. Sólo main frame puede usar los cuatro
IPC de dispositivos. La UI distingue registro de transferencia, invalida su
estado mediante `profileRevision` y cancela al desmontar. Flag off o perfil
efímero no usan red. El controlador conecta configuración selectiva, recuperación,
adaptadores y checkpoints protegidos. Un diálogo nativo cancelado puede seguir visible hasta
cerrarlo; su aceptación tardía no actúa ni permite abrir otro en paralelo.

La reconciliación local de 7.4 es de tres vías: última base confirmada, estado
local y revisión remota posterior. Una base desconocida no se sustituye por
vacío. Se comparan registros por ID y campos por presencia/valor, diferenciando
ausencia de null. Altas y cambios independientes se combinan; borrado/edición,
colisiones de ID nuevo y cambios incompatibles requieren elegir local/remoto.
Etiquetas son conjuntos con altas/bajas respecto de la base; no se truncan si
su unión excede veinte. Orden: posición y desempate ordinal por ID, sin relojes.
Si la unión de una categoría excede la cuota, se conserva un conflicto de
categoría completa. No se entrega payload parcial ni se aplica a stores aquí.

La revisión se identifica por SHA-256 de categoría, versiones e instantáneas
saneadas/canónicas. Decisiones de otra revisión, IDs duplicados y campos ajenos
fallan cerrado. `BrowserSyncConflictStore` conserva una revisión por categoría
en `sync-conflicts.json`, incluido el resultado decidido hasta confirmar commit
remoto/local. El documento completo usa safeStorage, versión y ámbito dentro
del texto protegido; no es un envelope transferible ni una nueva clave E2EE.
Hay cola por archivo, temporal exclusivo, fsync y reemplazo; no sobrescribe otra
revisión pendiente ni restaura respaldo automáticamente. Límites: 2 MiB por
instantánea, 28 MiB de diario en claro sólo en memoria y 40 MiB de archivo cifrado.
Un CAS posterior permite rebase sólo si la revisión previa ya está decidida:
base remota anterior, local resuelto y nuevo remoto, con decisiones nuevas.
Los adaptadores validan perfil/edición local, relaciones entre categorías y
commit antes de aplicar/retirar revisiones. El IPC sync-control no expone
envelopes ni rutas arbitrarias; la UI exige revisión nativa para configuración,
ejecución, recuperación y decisiones iniciales/conflictivas. Sin base común se
solicita elegir, no se interpreta ausencia como vacío. Checkpoints evitan eco
tras reapertura; pausar no borra claves ni revoca copias descargadas. La
cancelación se realiza por el canal existente y no revierte commits remotos.

Lia es propietaria del estado operativo sincronizable. El cliente genera una clave de sync protegida por el almacén del SO, cifra un envelope autenticado y envía sólo ciphertext, versión, tipo, dispositivo seudónimo e idempotencia. RLS aísla por \`auth.uid()\`. Contraseñas, cookies, passkeys y formularios se rechazan por esquema.

La capacidad permanece apagada si falta sesión federada, migración aplicada o clave recuperable. La recuperación usa archivo elegido y confirmado en main, sin código ni ruta en IPC. No hay recuperación por correo que permita al servidor descifrar. La integración con dos perfiles y servidor HTTP de prueba valida el recorrido del cliente, no el despliegue Lia/Auth/RLS real; éste es condición explícita del rollout en 9.5.

### Políticas empresariales como datos, no código

Las políticas usan un esquema cerrado versionado y sólo reducen permisos. No contienen scripts, comandos, expresiones ni URLs de descarga ejecutables. Se conserva la última política válida y su procedencia.

La precedencia se aplica antes de leer o cambiar ajustes y en un único conjunto
de interceptores de sesión, compartido con privacidad. La protección forzada
habilita estos interceptores aunque la preferencia local esté apagada; sin
protección local ni forzada, las cabeceras no se modifican. El bloqueo de
orígenes HTTP(S) incluye marcos y solicitudes fuera de la barra. Mientras se
verifica la política, o si falla, no se envían solicitudes administradas.
Las esperas fijan perfil, transición y generación; una respuesta de una
activación anterior no se publica aunque se vuelva a la misma cuenta. No se
introduce un proveedor remoto ni un IPC para que el renderer cambie políticas.

### Runtime estable y excepción explícita

Una compuerta inspecciona la versión efectiva de Electron. Prereleases se rechazan en release salvo un archivo de excepción versionado con vencimiento. El diagnóstico se deriva del runtime, no de constantes.

Se exige versión exacta coincidente en manifiesto, lockfile, paquete local y
ejecutable real. Este worktree instala Electron 43.4.0 sin modificar dependencias
del padre. La API de portapapeles admite string y Promise<string>. La matriz
nativa valida módulos reales; no sustituye el empaquetado completo de 9.5 ni
resuelve el aislamiento de zoom pendiente en 2.5.

### Diagnóstico local exportable por el titular del perfil

La telemetría inicial es una instantánea bajo demanda, no un recolector histórico
ni un envío remoto. El titular autenticado puede exportar únicamente el estado
operativo de su perfil actual: versiones, conteos de pestañas/vistas/grupos y
estados de los registros de descargas retenidos. Cada métrica declara fuente y
agregación; el periodo comienza al activar el perfil, pero los conteos describen
el instante de captura, no totales de actividad del periodo.

Main construye un JSON v1 de campos cerrados, sin identificadores, URLs, títulos,
nombres de archivo, mensajes de error, contenido o secretos. La UI sólo solicita
la exportación y recibe cancelación/éxito. Se requiere confirmación nativa con
cancelar por omisión y selector de destino JSON; no se sobrescriben archivos.
Una sola exportación puede estar pendiente, vence a los cinco minutos y se
invalida ante cambio de perfil, generación, ventana o cierre. No se consulta
historial, bóveda, cookies ni proveedores para generar el diagnóstico.

Esto no concede acceso administrativo a otros perfiles u organizaciones ni
implementa recolección centralizada. No hay persistencia periódica, listeners
nuevos de navegación ni polling. Los fallos se comunican sin rutas locales.

## Risks / Trade-offs

La cancelación CU usa una reserva main por servicio desde antes del primer
await de apertura. Su ID alimenta estado y aborto específico; abortar global
también retira solicitudes en cola. El registro se mantiene hasta terminar las
operaciones nativas pendientes, sin sobrescribir el estado del escritorio.
Las esperas de modelo y HITL pueden interrumpirse localmente; el SDK recibe
`config.abortSignal` y se descartan respuestas tardías. Apertura revalida perfil,
control y pestaña antes de navegar/enfocar y limpia la espera de viewport.
Esto no revierte efectos nativos ni garantiza cancelación en el proveedor.
El supervisor de 6.4 mantiene señal raíz y señales de fase: pausar aborta la fase,
espera drenaje nativo y publica pausa sin liberar la reserva. Reanudar inicia
percepción/conversación nueva con el mismo driver/guarda, ID y pasos restantes.
El recibo de ejecución impide reanudar una pausa posterior con un comando viejo;
detener acepta revisión de ejecución anterior sólo de la misma tarea/perfil.
El enlace main publica estados efímeros y avisos pendientes por `state-changed`,
sin persistir objetivos ni exponer control al runtime. Cierre/destino inválido
despiertan una pausa con cancelación. Se exige pestaña acoplada y se mantiene la
barra fuera de pantalla completa HTML. El smoke del producto/instalador Windows
permanece en 9.5; las pruebas automatizadas no lo sustituyen.

- [Alcance amplio y regresiones de navegación] → Fases pequeñas, flags, pruebas focalizadas y restauración compatible.
- [Bloqueo de rastreo rompe sitios] → Nivel equilibrado, excepción por origen, contador y recarga explícita.
- [Historial y auditoría crecen] → Retención, paginación, cuotas y compactación.
- [Exportar contraseñas crea texto plano] → Autenticación, advertencia, destino explícito y sin copia automática.
- [Sync pierde la clave] → Código de recuperación y mensajes claros; el servidor no puede recuperarla.
- [Política remota bloquea trabajo] → Última versión válida, diagnóstico y rollback administrativo.
- [Electron limita extensiones y navegación segura] → Catálogo curado y proveedores explícitos; no declarar paridad.
- [Actualizar Electron cambia compatibilidad web] → Matriz de smoke y rollback a la última versión estable aprobada.

## Migration Plan

Permisos, privacidad y política del agente mantienen JSON v1; comparten helper
de recuperación local con lectura acotada, cola por archivo, temporal exclusivo,
fsync y reemplazo. Una copia anterior `.recovery.bin` se cifra con safeStorage
y ámbito absoluto antes de modificar un principal existente. No respalda el
primer guardado ni copia claves/dispositivos sync. Recuperar requiere principal
ausente/corrupto, respaldo compatible y HITL nativo de cinco minutos con recibo
de perfil y sesión/control estables. Revalida los bytes revisados, conserva hasta
cinco originales dañados cifrados y aplica una proyección sin concesiones:
permisos ask/denied, privacidad estricta sin excepciones y agente strict/ask/block,
manteniendo managed bloqueado. El commit publica la caché restrictiva antes de
responder, sin releer con defaults permisivos. Restablecer permisos borra todas
sus copias locales antes de guardar, con advertencia de alcance y fallo parcial.
No promete bloqueo multiproceso, recuperación tras pérdida de disco, downgrade
automático ni durabilidad ante corte eléctrico. El helper admite codecs de atajos
y configuración sync sin cambiar sus principales cifrados v1. Configuración se
recupera desde el controlador con exclusión/cancelación, HITL y sin red; conserva
binding pero retira categorías/fecha de ejecución, sin restaurar claves,
dispositivos o escrituras pendientes. Pausar retira sus copias anteriores.
Memoria semántica se recupera con respaldo SQLite vacío protegido por el SO:
no restaura vectores ni fuentes retiradas, ni habilita Gemini. Soporte y HITL
main exigen perfil, control, sesión y gate vigentes; rechazan bases válidas,
futuras, ajenas, excesivas o con sidecars de transacciones pendientes. El original
dañado se conserva cifrado hasta la siguiente escritura válida de memoria.
Historial y bitácora conservan snapshots SQLite consistentes protegidos por el
SO, con rotación acotada. Su recuperación HITL valida esquema y ámbito, vuelve
a aplicar retención al confirmar y reconstruye FTS; borrar o reducir retención
retira copias antiguas antes de eliminar filas. No convierte el principal del
historial en una base cifrada ni garantiza un respaldo tras cada escritura.
Checkpoints y diario dañados/incoherentes se reconstruyen vacíos con sync
pausado, sin reutilizar decisiones o envíos aprobados. Un marcador protegido
con originales y proyección precede los reemplazos de los tres archivos y
bloquea operaciones ordinarias hasta completar o revertir con HITL. La reversión
local conserva bytes/ausencias originales y rechaza cambios externos; puede
devolver el daño original. No hay rollback atómico entre todos los stores,
undo remoto ni restauración de dispositivos revocados. La ruta de aplicación
continúa siendo flags y copia compatible con la app detenida.
El titular se encarga del despliegue y las migraciones remotas; no se ejecutan
en este worktree ni se acreditan con fixtures.

1. Introducir servicios y contratos P0 detrás de flags, migrar sólo metadata de sesión.
2. Migrar marcadores e historial con respaldos; conservar lectura legacy durante una versión.
3. Habilitar perfiles, protección y políticas del agente por defecto equilibrado.
4. Aplicar migración Lia y habilitar sync sólo tras verificar RLS, cifrado y revocación.
5. Activar controles empresariales y gate estable de release.
6. Retirar facades legacy después de una versión estable y evidencia de adopción.

Rollback: desactivar flags por capacidad, restaurar archivos \`.bak\`, conservar las particiones existentes y volver a la última versión estable aprobada. La migración remota de sync es aditiva y puede quedar sin consumidores sin borrar ciphertext.

## Open Questions

- El proveedor de reputación remoto puede elegirse durante P2 sin cambiar el contrato; la capa local y la degradación son obligatorias.
- La sincronización de contraseñas requerirá un cambio posterior independiente después de validar recuperación y autenticación fuerte multiplataforma.
