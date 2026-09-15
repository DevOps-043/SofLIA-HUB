# Plataforma del navegador integrado

Estado: vigente. Actualizado: 2026-09-11.

El navegador de Pulse Hub es una superficie de trabajo Electron basada en
`WebContentsView`; no pretende sustituir un navegador Chromium completo ni
ofrecer compatibilidad con Chrome Web Store. El contrato de evolución está en
el cambio OpenSpec `complete-integrated-browser-platform`.

## Fronteras

El esquema de sync en Lia está preparado y probado localmente, no desplegado.
Incluye dispositivos por sesión, RLS del propietario, versiones y recibos de
idempotencia; su rollback revoca accesos sin borrar ciphertext. El transporte
remoto, adaptadores locales, checkpoints y UI selectiva están implementados
detrás del flag de sync. El recorrido del cliente se verifica con dos perfiles
y servidor HTTP de prueba; Auth/RLS y dos equipos reales en Lia siguen siendo
condición del rollout, no evidencia obtenida. Registrar un equipo no transfiere
datos: requiere clave y categorías elegidas. La primera versión
excluye contraseñas y passkeys, aunque la bóveda local ya cifra toda su metadata.

- El contenido remoto usa `sandbox`, aislamiento de contexto, sin Node y una
  partición derivada del perfil autenticado.
- Cada capacidad renderer cruza servicio main, handler validado, allowlist,
  preload y wrapper tipado.
- Contraseñas guardadas y sus hashes permanecen en main. La UI sólo recibe
  metadata y hallazgos de salud; SofLIA no recibe secretos.
- Descargas sólo aceptan HTTP(S), sanean el nombre y escriben en Descargas. El
  contenido remoto no elige una ruta arbitraria.
- La sesión restaurable conserva URL, título, orden, grupo, silencio y fijación;
  nunca formularios ni contenido de página.

## Capacidades implementadas

### Voz, memoria opt-in y documentos sensibles

Orbe reconoce comandos españoles con prefijo literal `navegador`: siguiente/
anterior pestaña, estado de tarea, pausar, reanudar, detener y tomar control.
Frases no reconocidas con ese prefijo reciben ayuda, no se envían al modelo.
Reanudar pregunta en main y valida de nuevo el recibo. Estado no locuta
títulos/URL. Usa el runtime de voz y el supervisor existentes.
Evidencia: [voz](../../electron/integrated-browser/voice-commands.ts).

La memoria semántica está apagada por defecto y exige capacidad de gobernanza,
perfil persistente autenticado y consentimiento nativo. La persona reconstruye
explícitamente hasta 200 visitas y 200 marcadores. Google recibe títulos, rutas
URL sin parámetros/fragmentos y consultas; pueden ser personales y generar
costes. Usa `gemini-embedding-001`, 768 dimensiones; no envía cuerpos de páginas
ni formularios. El índice SQLite local queda cifrado con el SO, sin sync.
Búsquedas muestran fuentes vigentes y similitud, no respuestas inventadas.

Cancelar aborta y descarta respuestas tardías; no retira datos enviados.
Reconstrucción fallida conserva el índice anterior. Borrar el índice requiere
confirmación; caduca a los 30 días al acceder. Borrar/modificar una fuente en
historial o marcadores la excluye de resultados y depura el índice en la próxima
búsqueda, no equivale a borrado físico inmediato de la copia derivada.
Evidencia: [memoria](../../electron/integrated-browser/semantic-memory.ts).

Con gobernanza activa, una sonda en mundo aislado clasifica localmente contraseñas,
OTP, pagos, identidad, indicios médicos, autofill y otros formularios editables
excepto búsqueda conocida. Iframes, canvas, estructuras no inspeccionables o
agotamiento de cuota cierran el acceso. Antes/después de lecturas y capturas,
la detección impide devolver DOM/imagen al agente y solicita detener CU.
La UI anuncia continuar manualmente y espera el drenaje nativo; no ofrece
aprobar ni ignorar. Retirar el campo o cambiar el hash no levanta el bloqueo.
Una navegación nueva permite reevaluar.

Es una barrera conservadora con falsos positivos, no reconocimiento infalible
de cualquier dato sensible en texto/imágenes ni protección global de capturas
desktop. Autofill marca el documento antes de resolver el secreto.
Evidencia: [sonda](../../electron/integrated-browser/sensitive-page.ts).

### Bóveda: sesión Windows y formularios modernos

El gestor inicia bloqueado, sin leer preferencias/credenciales al abrir la
ventana. Desbloquear invoca Windows Hello/PIN con HWND de la ventana principal
mediante la API interop oficial. PowerShell del sistema ejecuta código fijo,
oculto, acotado y sin heredar claves de proveedores; no recibe contraseñas,
PIN ni biometría. No hay fallback de confirmación simulada ni proveedor
equivalente en macOS/Linux: si Windows no verifica, no se abre la bóveda.

La autorización dura cinco minutos desde verificar; se revoca al bloquear o
suspender Windows, cerrar ventana, cambiar perfil o pulsar Bloquear. Revisa
vigencia antes de publicar/confirmar operaciones, desmonta la biblioteca y
retira observadores. Es una barrera de aplicación añadida al cifrado DPAPI,
no una clave criptográfica nueva ni equivalencia E2EE con Proton Pass.

Sugerencias opt-in cubren submit confiable, botones de login SPA reconocidos
y Enter con campos inequívocos, incluso sin form. No leen subframes ni destinos
de formulario cruzados, ni deducen acceso exitoso. Un candidato de origen ya
verificado puede atravesar redirección SSO en la misma pestaña antes de revisar:
se cifra y conserva únicamente para el sitio inicial, anunciado en el diálogo.
Al mostrarlo se congela el documento; navegación posterior, cambio de pestaña,
bóveda, perfil, control o consentimiento invalida la revisión. Plazo: 60 segundos.
No vincula contraseñas entre dominios, no captura proveedores en popups/iframes
ni adivina usuarios ausentes en flujos multietapa: queda guardado manual.

Evidencia: [sesión SO](../../electron/integrated-browser/credential-unlock.ts),
[observador](../../electron/integrated-browser/credential-autosave-script.ts).
La prueba nativa de disponibilidad de Windows y los dobles de verificación no
sustituyen aceptar/cancelar Windows Hello interactivamente en el producto instalado.

### Capacidades generales

- Descargas con progreso, cancelación, reanudación, reintento, apertura y
  revelado en carpeta. Máximo 20 activas y 200 registros de sesión; nombres
  reservados entre descargas concurrentes y cancelación al cambiar de cuenta.
- Búsqueda en página, zoom con límites/reset, silencio por pestaña, pantalla
  completa, impresión y PDF con destino explícito. Las vistas usan
  `setZoomMode('isolated')` cuando Electron lo ofrece; el fallback compatible
  con Electron 43 mantiene el zoom Chromium en uno y aplica emulación desktop
  por WebContents: reflujo y escala de 50–300%, sin cambiar partición ni UA.
  El factor lógico sobrevive a navegación, resize, duplicado y reactivación.
  Clics DOM/autofill convierten coordenadas; CU mantiene coordenadas de captura.
  Cambiar zoom invalida observación y detiene la tarea supervisada vigente.
  No equivale a emulación móvil ni altera `devicePixelRatio` como el zoom nativo.
- Pestañas fijadas, grupos con nombre/color y asignación, reapertura, duplicado
  y cierres por alcance. La barra vertical comparte el orden de main y admite
  flechas, Inicio/Fin, Supr y Ctrl+Mayús+flechas para reordenar.
- Store de sesión versionado con cuota, respaldo, cuarentena de corrupción y
  restauración explícita detrás de `BROWSER_SESSION_RESTORE_ENABLED`.
  La versión 2 conserva primaria/secundaria, vista dividida o superpuesta y
  hasta cuatro ventanas separadas. Pestañas de fondo se restauran suspendidas:
  no se cargan 500 sitios al recuperar 500 pestañas lógicas.
- Marcadores por perfil en main, con deduplicación, etiquetas, búsqueda, orden
  editable y migración única del estado legacy de `localStorage`. La UI permite
  editar título, URL, carpeta y etiquetas; los errores no simulan un guardado.
- Generador local de contraseñas y análisis en main de contraseñas débiles o
  reutilizadas sin exponer secretos ni fingerprints.
- Perfiles autenticado, invitado y privado detrás de `profiles`: el autenticado
  usa una partición y stores persistentes por cuenta; invitado y privado usan
  particiones sin `persist:` y stores temporales en disco (no en memoria).
  Al cambiar de perfil o completar el cierre de la ventana
  se esperan las colas de los stores y se purgan cookies, caché y archivos del
  perfil efímero. La barrera cubre historial, sesión, marcadores, credenciales,
  políticas, permisos y extensiones antes del borrado. Aprobar la salida no
  purga una ventana viva: `beforeunload` todavía puede cancelar. `will-quit`
  retiene el proceso hasta completar la limpieza iniciada al cerrar realmente;
  un fallo ofrece reintentar, volver o salir sin completar mediante diálogo
  nativo. Reabrir espera la misma barrera. Un cierre forzado, fallo del proceso
  o apagado del sistema puede dejar archivos temporales; no se borran descargas.
  Cambiar de perfil cierra vistas e invalida operaciones pendientes. El selector
  conserva la cuenta para volver, pero cerrar sesión real revoca ese destino.
- Guardado manual ligado al origen mostrado por main y actualización por cuenta
  con confirmación nativa (cancelar por omisión). Editar no recupera la contraseña
  anterior. Cancelación, error o éxito limpian el campo; no se anuncia guardado
  sin metadata confirmada. El guardado sugerido es opt-in por perfil y requiere
  confirmación nativa al activarlo y para cada cuenta nueva/actualizada. Sólo
  detecta formularios principales y botones SPA compatibles, con clic/Enter
  confiable y acción del mismo origen. Un puente CDP aislado, distinto del agente, entrega
  el candidato a main; no hay secretos en consola ni IPC de respuesta. No
  afirma que el acceso fue exitoso. Pestaña, control, perfil, consentimiento u
  documento cambiado durante el diálogo invalidan la revisión. Requiere la
  autorización Windows descrita arriba, con caducidad fija de cinco minutos.
  Redirigir antes del diálogo conserva exclusivamente el origen inicial;
  formularios ambiguos, ventanas SSO separadas e iframes requieren guardado manual.
- Bóveda local v2: cifra también origen, usuario y fechas con AES-256-GCM; la
  clave aleatoria de cada instantánea está protegida por `safeStorage`. En
  Windows usa DPAPI, que no aísla de otros procesos del mismo usuario del SO.
  No es sincronización E2EE ni el modelo completo de Proton Pass. Migración
  v1→v2 serializada, respaldo cifrado, escritura temporal sincronizada y rechazo
  de corrupción/versiones futuras sin fallback silencioso. Borrar credenciales
  retira también su copia del respaldo, sin prometer borrado físico del disco.
- Historial SQLite con FTS5, paginación, fecha y dominio. Migración JSONL
  transaccional con marcador de idempotencia, cuota y respaldo legado.
  Retención configurable de 30/90/180/365 días o sin límite temporal (50 000
  visitas máximo), con confirmación de borrado. Limpia al registrar/consultar
  actividad y conserva la opción entre reinicios. El límite administrado más
  corto prevalece. La UI muestra hasta 25 pestañas cerradas en esta sesión y
  permite elegir cuál reabrir; un fallo no consume la entrada.
  El menú de aplicaciones mantiene estable la ausencia de favoritos, evitando
  ciclos de consulta/render; al cerrar o cambiar su contexto descarta respuestas
  pendientes de historial de la apertura anterior.
- Navegación segura local antes de cargar HTTP(S), con bloqueo de credenciales
  en URL y hosts configurados, avisos por pestaña para HTTP público y dominios codificados,
  y proveedor remoto opcional que sólo recibe protocolo, host y puerto. Las
  caídas del proveedor degradan a la revisión local; no se envían rutas ni
  tokens. La capa local cubre redirecciones, marcos, restauración, popups y
  descargas nuevas/reintentos/reanudaciones aun sin flags de privacidad/empresa.
  Los certificados inválidos se rechazan y los válidos conservan el verificador
  Chromium (`-3`), sin aceptar mediante `0` ni desactivar Certificate Transparency.
  La consulta remota cubre solicitudes gobernadas de navegación, marcos,
  redirecciones, ventanas hijas y descargas, además de la barra: no se envían
  IPs literales, nombres locales conocidos, páginas internas ni destinos de
  perfiles efímeros. No detecta nombres públicos que resuelvan a una red privada.
  Tiene plazo total de 1 s (máximo 5 s) y cuerpo máximo de 4 KiB; no sigue
  redirecciones ni acepta credenciales en el endpoint. El texto del proveedor
  no se publica y un permiso remoto no reduce una advertencia local. La barra
  diferencia advertencia, último intento bloqueado y proveedor no disponible,
  sin declarar el destino seguro. Los avisos se transmiten en el estado existente,
  no se persisten ni se heredan entre documentos/perfiles; las respuestas
  obsoletas no los modifican. Los bloqueos muestran un intersticial main aislado
  también en ventanas separadas/hijas, sin JavaScript, preload, Node ni red.
  Sólo permite cerrar o abrir una página en blanco; no ofrece bypass. Un cambio
  de hash no retira un bloqueo vigente y el agente no lee detrás del aviso.
  El smoke nativo cubre tráfico de marcos, ventanas hijas, descargas y rechazo
  TLS con certificado autofirmado, sin modificar el almacén de confianza del SO.
- Extensiones sólo en perfiles autenticados persistentes, con acceso a archivos
  desactivado. La revisión, copia y escritura fijan directorio, generación y
  ventana; cambiar de perfil descarga extensiones activas y retira cargas tardías.
  Una carga nueva se retira si falla guardar su registro. Al instalar se fija
  SHA-256 del inventario ordenado de nombres, tamaños y hashes de cada archivo.
  Restaurar o habilitar vuelve a inspeccionar y comparar antes de la carga nativa;
  archivos nuevos, eliminados o modificados bloquean la carga. Paquetes antiguos
  sin huella deben retirarse y reinstalarse con revisión, no se aceptan solos.
  La huella detecta cambios, no autentica al editor ni aísla de un proceso que
  pueda modificar paquete y registro. No hay vigilancia continua después de
  cargar ni bloqueo multiproceso. El catálogo inicial contiene el ejemplo oficial
  Reading Time de GoogleChrome, revisión inmutable y siete SHA-256 distribuidos
  con la aplicación en `extension-catalog.ts`. No confía en hashes aportados por
  la carpeta ni acepta archivos extra. La fuente pública y versión se muestran;
  el usuario descarga la carpeta exacta por su cuenta y solicita revisión nativa.
  No hay descarga/actualización automática ni verificación PGP en runtime.
  Actualizar o reinstalar exige confirmación, extensión deshabilitada y páginas
  en blanco. Prepara una copia nueva, conserva restricciones por sitio, verifica
  y carga antes de sustituir el registro; un fallo mantiene la copia anterior.
  Tras éxito retira sólo la copia sustituida; una interrupción puede dejar una
  carpeta inactiva. Versiones nuevas del catálogo requieren revisión y nuevos
  pines en una actualización de la aplicación. No es Chrome Web Store ni paridad
  con su catálogo: este ejemplo funciona sólo en artículos de Chrome Developers.
  El panel permite reducir sitios para MV3 con permisos storage/scripting:
  main verifica integridad, intersecta hosts/scripts/recursos del manifiesto
  aprobado, elimina permisos opcionales y guarda una nueva huella. No amplía
  permisos: restaurar un sitio retirado requiere reinstalar la carpeta original.
  La selección aplica a esquema y dominio exactos, todos sus puertos; no es
  aislamiento por puerto ni cortafuegos. Los scripts estáticos quedan sólo en
  marco principal, sin herencia a about:blank/data:. Se rechazan capacidades
  globales incompatibles. Antes de mutar, exige extensión deshabilitada y
  páginas cerradas (última pestaña en about:blank), sin control del agente;
  así no sobreviven scripts inyectados en documentos anteriores. Un fallo
  entre manifiesto y registro bloquea habilitación por huella, no se aprueba
  el estado parcial. La recuperación en ese caso es reinstalación revisada.
- Passkeys se ejecutan mediante WebAuthn de Chromium y su proveedor nativo;
  no forman parte de la bóveda ni del sync. El selector maneja el evento de
  elección de cuenta con diálogo nativo, cancelar por defecto,
  diez cuentas máximo y plazo de 60 segundos. Exige marco principal seguro,
  perfil autenticado, documento visible y control humano; invalida por
  cambio de sesión, documento, ventana o control. Sólo devuelve el ID al
  callback nativo, sin IPC ni persistencia. Marca ese documento como identidad
  sensible e impide lectura/captura agéntica incluso sin agentGovernance.
  Este evento no intercepta todas las peticiones WebAuthn: Chromium conserva
  la UI nativa de registro/autenticación. La prueba real consulta disponibilidad
  Windows; altas y aserciones usan autenticador virtual. Aceptación humana con
  Windows Hello/llave y autofill condicional no están acreditados.
- Marcadores HTML con selección y revisión nativas antes de escribir. El resumen
  sólo muestra conteos de nuevos, duplicados, conflictos e inválidos; cancelar
  es la opción predeterminada. Se puede importar sólo nuevos o actualizar
  título, carpeta y etiquetas de conflictos conservando identidad y orden.
  La primera URL válida del archivo prevalece ante duplicados internos.
  La lectura está acotada a 5 MiB y se rechazan esquemas peligrosos.
  La aprobación vence en cinco minutos, sirve una sola vez y se invalida al
  cambiar perfil, ventana o revisión de la biblioteca. Los errores imprevistos
  de esta importación se convierten en mensajes controlados, sin rutas locales.
  Carpetas anidadas usan rutas separadas por `/` (máximo 100 caracteres);
  HTML preserva esta jerarquía y las etiquetas. Carpetas vacías no se importan.
  La exportación exige un archivo nuevo: no sobrescribe destinos existentes.
- Transferencia de credenciales JSON sólo desde main: advertencia nativa antes
  de exportar texto legible, destino elegido por el usuario, archivo nuevo con
  permisos restringidos, límite de 5 MiB y revisión de conflictos antes de
  importar. El renderer recibe únicamente conteos; el formato nunca se
  registra ni se entrega al agente.
- Importación de historial JSON/JSONL detrás de `advancedHistory`: selector y
  revisión nativos, cuota de 5 MiB y 50 000 visitas, deduplicación por URL y
  timestamp, soporte para `last_visit_time` de Chromium y commit SQLite en una
  sola transacción. El renderer sólo recibe conteos; cancelar es la opción
  predeterminada y los cambios de perfil invalidan la confirmación.
- Protección experimental de red por sitio con reglas locales acotadas,
  excepciones y cookies de terceros clasificadas por dominio registrable.
- Gobierno experimental por origen, aplicado también al driver visual.
  Permitir una vez no persiste; una navegación invalida el consentimiento.
  Cada tarea fija pestaña, vista, ventana, perfil y revisiones de foco, política
  y control; cada captura fija además URL/revisión visual. Cambiar de pestaña y
  volver no habilita una tarea anterior. Un contexto obsoleto termina como
  bloqueado sin recapturar automáticamente otro destino. Se revalida después
  del marcado y de las esperas nativas, también antes de navegar y enviar Enter.
  `AbortSignal` llega al driver: cancela permisos pendientes y esperas, descarta
  resultados tardíos e impide nuevas peticiones al modelo tras la cancelación.
  Las tareas visuales de navegador se reservan antes de abrir la vista, con ID
  propio en estado/tareas activas y cancelación por ID o global. No pisan el
  estado de una tarea de escritorio concurrente. `Detener todo` también retira
  la cola y resuelve sus solicitudes como canceladas.
  La señal llega a apertura, viewport, loop y `config.abortSignal` del SDK.
  Las esperas del modelo/HITL terminan localmente incluso si no responden;
  resultados tardíos no reanudan el loop. Una navegación o entrada nativa ya
  emitida debe terminar antes de liberar la reserva y admitir otra tarea.
- Diagnóstico saneado de las versiones efectivas del runtime.
- Bitácora del agente por perfil en SQLite v1, bajo `agentGovernance`.
  Cada operación registra inicio y resultado con traza compartida para acciones
  anidadas, pestaña seudónima y sólo el origen de la URL. El detalle usa
  `safeStorage`; sólo ID aleatorio y fecha se indexan sin cifrar. No conserva
  argumentos, resultados textuales, errores crudos, formularios ni capturas.
  Consultar es explícito, en páginas de 50. Retención de 7/30/90 días (30 por
  defecto), máximo 5.000 eventos y 16 MiB de archivo; se depura al leer/escribir.
  Borrar o cambiar retención exige confirmación nativa, control humano y contexto
  vigente, con plazo de cinco minutos y una sola revisión pendiente. Si falla
  registrar el inicio no se ejecuta la acción. Un inicio sin cierre indica
  interrupción; completar una operación no acredita cumplir el objetivo del usuario.
- Soporte permite actualizar las versiones visibles y exportar una instantánea
  local JSON con confirmación nativa. Contiene esquema, periodo del perfil y 12
  métricas con fuente: pestañas lógicas/vivas, ventanas separadas, grupos y
  conteos por estado de las descargas retenidas. Son valores de la captura, no
  totales históricos del periodo. No consulta historial, bóveda ni cookies.
  No incluye identificadores, URLs, títulos, nombres de archivo o errores crudos;
  no se envía automáticamente. Sólo el titular del perfil actual puede exportar,
  sin acceso administrativo a otros perfiles. No hay polling ni colector periódico.

## Flags

Los defaults viven en
`electron/integrated-browser/feature-flags.ts`. Las herramientas P0 están
activas; restauración, perfiles, privacidad, gobierno del agente, sync y
empresa permanecen desactivados hasta completar su fase y evidencia. Los
valores admitidos son `true/false`, `1/0`, `yes/no` y `on/off`; un valor
desconocido conserva el default seguro.

Restauración, privacidad, gobierno del agente y empresa mantienen sus gates;
descargas, herramientas de página, marcadores y pestañas avanzadas también
respetan sus flags P0. `profiles` gobierna el selector y `encryptedSync` impide
crear la conexión de dispositivos cuando está apagado. Deshabilitar sync y
reiniciar impide nuevas consultas/registros; no revoca el servidor ni borra
copias existentes. `advancedHistory` no es un interruptor de almacenamiento. En particular,
SQLite y los marcadores main se usan también con `advancedHistory=false`; ese
valor no devuelve el historial al formato JSONL. El rollback exige retirar el
cambio de código y conservar los datos nuevos, no alternar flags aún no
conectados.

## Runtime y release

`package.json` fija Electron `43.4.0`, versión estable publicada. La compuerta
`npm run runtime:stable` rechaza versiones prerelease salvo una excepción
versionada que incluya vencimiento, riesgo y rollback. `verify:release` ejecuta
esta comprobación antes del empaquetado. La compuerta exige coincidencia entre
manifiesto, lockfile, paquete instalado y versión emitida por el ejecutable.
Este worktree tiene instalación local 43.4.0 y smoke nativo; no usa la beta
del directorio padre. La compatibilidad del portapapeles admite retorno síncrono
o asíncrono. El instalador y el smoke completo del producto permanecen en 9.5.

## Persistencia y recuperación

Los stores viven bajo el perfil saneado de
`electron/integrated-browser/profile-scope.ts`. JSON usa temporales únicos;
los respaldos dependen del store. La sesión pone archivos corruptos en
cuarentena y recupera un respaldo válido si falta el principal o está corrupto.
La sesión serializa lecturas, guardados y descartes por archivo entre instancias,
limita la lectura a 1 MB y sincroniza el temporal antes del reemplazo. El
principal nunca se mueve para crear el respaldo; un fallo de reemplazo conserva
la versión anterior. No se promete durabilidad ante corte eléctrico del disco.

Los marcadores serializan mutaciones y revisiones por archivo entre instancias del mismo
proceso y conservan el esquema v1. Guardan en un temporal exclusivo, sincronizan
su contenido y copian el principal a un respaldo antes del reemplazo atómico;
un fallo anterior al reemplazo no elimina el principal. La revisión de importación
compara una huella de la biblioteca antes de aplicar cambios y vuelve a validar
el contexto antes de emitir el reemplazo. No hay bloqueo entre procesos ni
recuperación automática del respaldo de marcadores. La recuperación explícita
valida principal ausente/corrupto y respaldo, muestra conteos y exige HITL nativo.
La aprobación de un solo uso caduca en cinco minutos y fija contexto y huellas;
no sobreescribe una versión futura ni acepta cambios concurrentes.

El parser migra v1 a v2 en memoria, sin modificar la fuente hasta guardar. El
primer guardado conserva v1 en `.bak`; los siguientes rotan una sola generación.
Versiones desconocidas o errores de permisos/E/S no se tratan como corrupción
ni autorizan sobrescritura. La proyección de tabs/grupos excluye extras y rechaza
IDs duplicados, referencias inválidas y URLs con usuario/contraseña embebidos.
Las URLs pueden contener consultas: el snapshot no es un registro de auditoría
saneado ni se envía al agente.

Descartar escribe primero una sesión vacía válida, y después retira `.bak`.
Así un cierre entre ambos pasos no ofrece otra vez la sesión descartada. Los
archivos `.corrupt-*` no se cargan automáticamente; se conservan para recuperación
manual y no se promete que descartar equivalga a borrar esos archivos. Una
sesión ofrecida para restauración no se sobrescribe al navegar/cerrar sin elegir.
Los fallos se informan sin incluir contenido ni rutas en los avisos de sesión.

`flushSessionForShutdown` espera el guardado de una ventana ya desmontada y
captura cambios de metadata que llegan durante la escritura. Suspende el
autosave durante la preparación; cancelar lo reactiva. La aprobación impide un
segundo guardado desde `detachWindow` y permite cerrar ventanas separadas sin
reintegrarlas. La barrera del lifecycle y del actualizador vive en
`electron/main/shutdown-guard.ts`: cinco segundos antes de preguntar, una sola
salida pendiente y consentimiento explícito para salir sin guardar.

Una segunda barrera en `electron/main/app-lifecycle.ts` impide que `will-quit`
termine el proceso antes de `flushClosedProfileForShutdown`. No ejecuta purga
desde `commitShutdown`: cancelar `beforeunload` conserva ventana, cookies y
stores. La limpieza captura el perfil saliente antes de esperar, drena todas
las colas incluso si una falla y revoca escrituras nuevas y permisos tardíos.
Al terminar invalida cachés y snapshots de sesión; un fallo no se anuncia como
éxito. La vuelta a la aplicación abre una ventana que espera la limpieza pendiente.

Historial usa transacciones SQLite, secure-delete en FTS y
checkpoint/VACUUM en borrados explícitos. Borrar historial elimina también
su respaldo JSONL completo, aunque el intervalo sólo afecte visitas recientes
en la base activa; no se promete borrado físico irrecuperable de un SSD.

Las operaciones nuevas de historial, marcadores, permisos, bóveda, privacidad, política del agente y claves
capturan su destino antes de esperar E/S. Cambiar de cuenta cierra SQLite,
cancela descargas pendientes y descarta sus registros; no elimina archivos
ya descargados. La sesión saliente se captura antes de desmontar pestañas; no se
abren vistas mientras cambia el perfil, y una transición superada o una lectura
tardía no publica estado del anterior. Si falla cerrar el historial, el navegador
permanece bloqueado hasta reintentar el cambio de perfil.
Contadores de privacidad son de sesión y permanecen en memoria.
El autofill comprueba pestaña, URL, revisión y cuenta antes y después de cada
espera nativa; si cambia el destino no continúa rellenando. Una sesión SO de
bóveda vigente es obligatoria, además de estas guardas.

El guardado y la importación de la bóveda usan una revisión cifrada main-only,
de un solo uso y cinco minutos. El commit verifica el contexto y la huella del
archivo leído; si otra operación cambió la bóveda se solicita revisar otra vez.
La cola por archivo serializa instancias dentro del proceso. Un temporal
exclusivo se sincroniza antes del reemplazo; un fallo conserva el archivo
anterior. La exportación descifra sólo en main después de advertencia nativa y
escribe con `wx`; la importación no expone secretos ni rutas por IPC. No es un
bloqueo multiproceso ni un respaldo recuperable tras pérdida del disco.
La comprobación inmediatamente anterior a `rename` no puede revocar una
escritura que el SO ya recibió; el destino permanece fijado al perfil original.
La recuperación de bóveda admite principal ausente o corrupción reconocida con
respaldo cifrado válido. Main valida ámbito, GCM, esquema y secretos internos;
rechaza principal válido, versiones exteriores/interiores futuras, permisos
insuficientes, enlaces y archivos no regulares o excesivos. Exige HITL de un solo
uso, cinco minutos y contexto vigente; conserva el respaldo y desactiva sugerencias.
Principal ausente: publicación exclusiva, sin reemplazar un archivo aparecido.
Principal dañado: conserva primero los bytes exactos codificados dentro de una
copia protegida con safeStorage y ámbito, con nombre `.corrupt-UUID`. Máximo
cinco copias, sin purga automática; original máximo 17 MiB. Revalida los bytes
revisados antes del reemplazo atómico bajo la cola del proceso, sin prometer
bloqueo de escritores externos. Si falla el reemplazo conserva principal y copia.
Las copias no se cargan automáticamente ni son envelopes de bóveda v2; requieren
descifrado y recuperación explícitos en el contexto del usuario del SO.

Eliminar una credencial o vaciar la bóveda retira completas sus copias cifradas
de principales dañados, porque no se puede depurarlas por cuenta con seguridad.
La UI avisa este alcance antes de confirmar. La limpieza de copias precede a la
escritura del borrado; un fallo informa error y puede dejar copias ya retiradas,
pero no anuncia eliminación de la cuenta. Sólo se consideran nombres propios
con UUID y archivos regulares, sin borrar carpetas ni archivos ajenos.
Historial, bitácora y memoria semántica comparten creación SQLite v0→v1
transaccional: DDL, validación y versión se publican juntos; un error hace
rollback. Una base sin versión pero con objetos, una versión futura o un
esquema v1 incompleto se conservan sin crear tablas vacías de reemplazo.
Permisos por sitio usa defaults ante lectura fallida y bloquea mutaciones:
no confunde acceso denegado/corrupción/versión futura con archivo nuevo.
Cada escritura vuelve a leer disco y descarta concesiones cacheadas si falla.
Permisos, privacidad y política del agente conservan su formato principal JSON
v1. Antes de modificar un archivo existente y válido guardan una generación en
`<archivo>.recovery.bin`, protegida por safeStorage y ligada a la ruta absoluta
del perfil. Crear un archivo por primera vez no genera respaldo. La ausencia
del principal con copia existente exige recuperación explícita, no crea un
almacén vacío. La falta de cifrado seguro impide rotar la copia y guardar;
el principal sigue siendo metadata JSON, no una bóveda cifrada.

El panel de soporte permite recuperar estos tres almacenes sólo al titular del
perfil autenticado y bajo control humano. El DTO cerrado y el diálogo nativo
no aceptan rutas ni aprobaciones renderer. La revisión main es de un solo uso,
vence a los cinco minutos y verifica sesión (incluido salir/volver), perfil,
ventana, control y bytes del principal y respaldo antes de publicar.
No reemplaza principales válidos, versiones futuras, accesos denegados,
enlaces ni archivos excesivos: límites de 8 MiB principal y 16 MiB protegido.
La proyección retira concesiones: permisos denegados siguen denegados, los
demás requieren preguntar; privacidad estricta sin excepciones; agente estricto
con nueva autorización, conservando bloqueos y políticas administradas bloqueadas.
La recuperación no modifica la política empresarial ni claves/dispositivos sync.

Si hay principal dañado se conserva cifrado en `.damaged-UUID.bin`, máximo cinco
copias sin purga automática. Se conserva también el respaldo revisado. Guardados
y recuperación comparten cola por archivo y barrera de flush; publican con
temporal exclusivo sincronizado y rename/link. Un fallo previo a la publicación
preserva el principal; si sólo falla limpiar un temporal ya publicado se avisa
sin anunciar falsamente que falló guardar. No garantiza bloqueo multiproceso,
respaldo portable, corte eléctrico ni borrado físico irrecuperable.
Restablecer permisos de un sitio o vaciarlos elimina todas las copias locales
de recuperación de permisos de ese perfil antes de guardar; la UI avisa este
alcance. Una limpieza parcial puede retirar copias aunque falle el guardado.
Fuente: [recuperación de políticas](../../electron/integrated-browser/policy-file-recovery.ts).
El mismo mecanismo soporta codecs que conservan el formato cifrado original de
atajos y configuración sync; versiones, ámbito ajeno y cuotas son incompatibilidad,
no corrupción recuperable. Historial y bitácora también tienen recuperación
SQLite con los límites descritos a continuación.

Después de una operación válida, historial y bitácora generan una instantánea
consistente mediante `VACUUM INTO`, incluyendo el WAL a través de SQLite, y
guardan una generación protegida por el SO, ligada a la ruta absoluta. Rotan
bajo demanda como máximo cada 30 segundos; no hay temporizador de transferencia
ni una copia por evento. Un fallo del respaldo posterior al commit informa una
advertencia sin presentar el guardado principal como fallido. La recuperación
requiere que exista una copia compatible; no se garantiza copia si falló disco,
cifrado o cuota. Límites de lectura: 128 MiB SQLite y 256 MiB protegido; bitácora
mantiene su cuota principal de 16 MiB. El historial principal sigue siendo
metadata SQLite sin cifrar; sólo su respaldo y cuarentena se protegen por el SO.

La revisión cierra primero la conexión del historial y rechaza bases sanas,
futuras, esquemas ajenos, enlaces, excesos y WAL/SHM/journal pendientes. Valida
integridad, registros y formato; prepara otra SQLite sin escribir el principal.
Antes de publicar revalida los bytes, reevalúa retención y reconstruye el FTS
del historial sin reimportar JSONL. Bitácora conserva los eventos y su cifrado,
no acciones ejecutables. Los originales dañados se cifran (máximo cinco).
Borrado, recorte por cuota y retención invalidan las copias anteriores **antes**
de borrar filas; después puede generarse una nueva copia depurada. Un fallo
parcial puede retirar copias sin terminar el borrado. No hay borrado forense,
bloqueo multiproceso ni promesa de recuperar escrituras posteriores a la copia.
Fuente: [recuperación SQLite](../../electron/integrated-browser/sqlite-store-recovery.ts).

La memoria semántica tiene recuperación local distinta: al escribir valida la
instantánea anterior y crea un respaldo SQLite de esquema vacío protegido por
el SO, ligado a la ruta del perfil. No respalda fuentes ni vectores porque son
datos derivados y podrían haberse retirado. Un principal ausente con respaldo
no se recrea durante una lectura o escritura normal. Soporte ofrece `semantic`
bajo `agentGovernance`, perfil autenticado, control humano y confirmación nativa.
Recuperar deja el índice vacío y desactivado: no consulta fuentes, Gemini ni red;
su reconstrucción requiere otra activación consentida. Puede desactivar el
índice aun cuando la organización no permita activar funciones del agente.

La revisión de cinco minutos inspecciona SQLite en modo sólo lectura y rechaza
bases sanas, versiones distintas de v1, ámbitos ajenos, esquemas desconocidos,
cuotas excedidas y sidecars WAL/SHM/journal: no separa transacciones pendientes.
Sólo admite ausencia o corrupción reconocida. Límites: 16 MiB principal y 32 MiB
protegido. Verifica bytes y contexto de nuevo antes del reemplazo y conserva
hasta cinco originales dañados cifrados. La siguiente escritura válida de memoria
retira esas cuarentenas antes de guardar, para no perpetuar fuentes borradas;
el respaldo vacío permanece. La limpieza parcial puede retirar copias aunque
falle guardar. No se promete recuperación de vectores, bloqueo multiproceso,
borrado forense ni recuperación tras pérdida de disco. Fuente:
[recuperación de memoria SQLite](../../electron/integrated-browser/semantic-memory-recovery.ts).
Los canales de credenciales exigen el frame principal autenticado y no
operan mientras el agente controla el navegador. Los errores inesperados se
redactan antes de salir por IPC y de alcanzar el log exterior.

## Funciones experimentales y límites abiertos

### Atajos reutilizables de lectura

El menú del compositor ofrece **Atajos del navegador**: crear, editar, usar y
eliminar hasta 50 instrucciones, con nombre de 80 caracteres e instrucción de
5000. La biblioteca requiere `agentGovernance`, perfil persistente autenticado,
agente permitido por la organización y control humano. No se modifican flags
ni se guardan atajos en privado/invitado.

`agent-shortcuts.v1.bin` guarda una instantánea protegida por `safeStorage`,
ligada al ámbito y con revisión optimista. Se valida un máximo de 2 MiB antes
de descifrar; versiones futuras, corrupción y permisos insuficientes fallan
cerrados. El reemplazo usa temporal exclusivo y rename; no hay bloqueo
multiproceso, recuperación automática ni garantía de durabilidad ante corte
eléctrico. Eliminar exige confirmación nativa de cinco minutos y contexto
vigente, sin promesa de borrado forense. No es sync E2EE ni bóveda de secretos.
Lecturas, escrituras y recuperación son asíncronas y comparten cola por archivo;
el cierre espera flush. Antes de modificar un principal válido se conserva una
generación protegida; recuperar desde soporte requiere HITL, perfil propio y
gobierno del agente permitido. Conserva instrucciones, renueva IDs y revisión
para invalidar editores antiguos, y no ejecuta nada. Eliminar un atajo retira
todas las copias de recuperación de su biblioteca, con advertencia nativa.

`sync-settings.json` conserva el sobre v1 protegido por el SO y su límite de
8 KiB. Su respaldo se genera antes de modificar una configuración existente
activa. La acción humana `recover-settings` verifica formato/ámbito, conserva
el original dañado y restaura categorías vacías y fecha de última ejecución
nula: nunca reactiva transferencia. Se serializa con operaciones del controlador,
admite cancelar y no consulta Auth ni red; la disponibilidad local de clave se
comprueba antes del commit sin leerla hacia IPC. Guardar pausa elimina todas
sus copias locales. No recupera claves, dispositivos, checkpoints o decisiones
de conflictos ni sustituye la revisión de primera sincronización.

Para checkpoints y diario dañados o incoherentes, `recover-state` conserva los
tres originales cifrados, pausa categorías y reconstruye metadata vacía. No
restaura decisiones ni envíos aprobados: reactivar exige una revisión nueva.
No lee datos del servidor ni modifica claves, dispositivos o datos del navegador.
El controlador exclusivo solicita HITL nativo y verifica perfil/sesión/control.
Antes del primer reemplazo publica `sync-recovery.pending.bin` protegido y ligado
al directorio absoluto; mientras exista, los stores y operaciones ordinarias
quedan bloqueados, incluso tras reiniciar. `rollback-state` permite revertir una
recuperación incompleta con otra confirmación, sólo si cada archivo coincide
con el original o la proyección de esa operación; conserva ausencias originales.
Una reversión puede devolver la corrupción original. No es undo remoto ni
rollback atómico de todo el perfil. Al terminar conserva un archivo protegido
de evidencia, hasta cinco; nunca purga evidencia automáticamente ni restaura
identidades revocadas. Un marcador ilegible o archivos cambiados externamente
exigen revisión operativa, no eliminación automática del bloqueo.

El atajo sólo prepara un borrador si está vacío. No envía el mensaje ni guarda
URLs, recibos de pestañas, páginas o concesiones de sitio. Cada envío exige de
una a ocho pestañas frescas del perfil declarado; rechaza Skills, imágenes,
selección de texto, aplicaciones y modos especiales. Reutiliza el flujo de
fragmentos citables, sin herramientas externas; las políticas de lectura se
evalúan de nuevo. Cambiar cuenta/conversación no degrada el atajo a chat libre.
El usuario puede quitar explícitamente el modo antes de enviar como chat normal.

### Otros límites

La supervisión visual CU se implementa en
[`browser-cu-supervisor.ts`](../../electron/desktop-agent/browser-cu-supervisor.ts)
y [`BrowserAgentTaskControls.tsx`](../../src/components/browser/BrowserAgentTaskControls.tsx).
La UI distingue preparación, ejecución, pausa pendiente, pausa y detención.
Pausar cancela la espera al modelo y espera operaciones nativas ya emitidas;
reanudar conserva destino, ID y presupuesto, con nueva captura/conversación.
Revisiones de ejecución rechazan comandos tardíos; tomar control y detener
cancelan, sin anunciar liberación antes de la limpieza. Se retiran permisos
cancelados sin persistir una decisión de sitio. La pestaña debe estar acoplada
y no se permite pantalla completa HTML durante la supervisión. Esta evidencia
es automatizada, no una validación del producto instalado en Windows.

- Privacidad: lista inicial pequeña; no ofrece todavía navegación segura
  contra malware ni mitigación completa de APIs de fingerprinting. En nivel
  estricto elimina client hints de alta entropía y las respuestas `Accept-CH`,
  manteniendo hints básicos y User-Agent compatible. No se modifican
  parámetros de subrecursos ni cookies de navegaciones principales.
- Agente: sitios desconocidos preguntan; permitir un sitio en modo equilibrado
  autoriza lecturas posteriores. Timeout/cierre de ventana deniega esa operación
  sin persistir un bloqueo. Las capturas pueden contener información visible.
  La barrera local sensible descrita abajo añade handoff obligatorio; el smoke
  del producto completo sigue pendiente.
  La detención general ya alcanza apertura y consultas CU en curso;
  no deshace entrada emitida ni garantiza cancelar cómputo/cargos del proveedor.
  La pausa y controles dedicados tienen pruebas automatizadas. La comprobación
  de revisión detecta navegación/eventos del navegador, no todas las mutaciones
  autónomas de una aplicación web entre dos capturas.
- Sync: existen cifrado local AES-256-GCM, reconciliación de tres vías, diario
  cifrado de conflictos y transporte main con verificación Auth. El panel de
  dispositivos permite consultar, registrar y revocar con confirmación nativa,
  sin hostname/MAC: un ID aleatorio por sesión se protege en el perfil antes del
  RPC para reintentar sin duplicarlo. Consultar no registra; la sesión revocada
  necesita nueva autenticación y consentimiento. Cambiar de perfil/ventana
  cancela solicitudes e invalida respuestas; cancelar no revierte escrituras ya
  recibidas por el servidor. Un diálogo nativo pendiente puede seguir visible,
  pero su aprobación tardía no permite mutar. El transporte tiene cuotas,
  reintentos acotados y plazos sobre cabeceras y cuerpo; no usa el cliente genérico
  que elimina AbortSignal. `sync-controller.ts` conecta configuración selectiva,
  cliente, stores y checkpoints protegidos; la UI permite sincronizar bajo demanda,
  cancelar, pausar, exportar/importar clave mediante archivos elegidos en main y
  resolver la primera sincronización/conflictos con revisión nativa. No hay
  sincronización periódica en segundo plano. Acepta esquemas cerrados de marcadores, pestañas,
  grupos y preferencias; URLs transmitibles pierden query/fragmento.
  El código de recuperación no cruza IPC; una clave corrupta no se regenera y recuperar
  otra clave sobre una existente se rechaza. Esto no clasifica secretos que
  una persona haya escrito voluntariamente en un título o etiqueta.
  `sync-conflicts.ts` combina campos independientes; diferencias del mismo
  campo, borrado/edición, ID nuevo colisionado o unión sobre cuota conservan
  ambas variantes. No devuelve un payload aplicable mientras falten decisiones.
  `sync-conflict-store.ts` conserva por perfil base, local, remoto y selección
  bajo safeStorage con revisión ligada al contenido; no es un archivo E2EE
  transportable. Un CAS posterior genera una nueva revisión desde la decisión
  anterior; sólo se retira tras commit remoto/local confirmado por el cliente.
  Los adaptadores comprueban perfil, ediciones concurrentes y relaciones entre
  categorías antes de aplicar; los checkpoints evitan repetir escrituras al
  reabrir. La primera base desconocida exige elegir, no se sustituye por vacío.
- Empresa: store cerrado, último valor válido y recuperación por respaldo.
  Corrupción sin respaldo bloquea el acceso. La carga precede navegación,
  creación de pestañas y habilitación de extensiones. Falta proveedor de
  políticas autorizado, actualización en vivo y cobertura de todos los ciclos.
- Los perfiles privados/invitado están implementados con los límites de limpieza
  descritos arriba. No están acreditadas passkeys interactivas ni proveedores de autenticación
  de bóveda para macOS/Linux ni persistencia de descargas entre
  reinicios. Se verificaron módulos focalizados con un binario Electron estable
  instalado en este worktree; faltan empaquetado y smoke completo de la aplicación.
- Sesiones: la regresión automatizada usa dobles Electron y disco temporal real;
  el smoke focalizado también ejecuta `before-quit`/`will-quit` y la barrera de
  guardado en procesos Electron reales. Faltan el cierre del producto completo,
  fallos nativos al crear ventanas y el instalador real. Estas pruebas no cubren
  cierre forzado, apagado o logout de Windows. No se
  recuperan geometría de ventanas, historial de
  navegación atrás/adelante, formularios, zoom o pantalla completa. Las ventanas
  separadas usan dimensiones predeterminadas dentro de la pantalla actual.

## Adjuntos de pestañas y citas

`@` en el compositor y «Añadir pestañas» permiten elegir hasta ocho pestañas,
buscar por título/sitio y desmarcar. El menú sólo obtiene metadata. Al enviar,
main comprueba revisión de perfil y token de documento, aplica la política de
lectura y devuelve texto fresco con título observado; nunca reutiliza el texto
de un chip. Hasta tres fragmentos de 1000 caracteres por pestaña, no una lectura
completa de documentos embebidos o lienzos. Un fallo, texto vacío, cambio de
documento o plazo agotado conserva el borrador sin enviar análisis parcial.

La respuesta conserva referencias `P1:F1` con extracto desplegable, sitio y
fecha. URL sin consultas, fragmentos ni credenciales; esos datos eliminados
pueden ser necesarios para reabrir exactamente la página original. Regenerar
conserva los extractos históricos y no relee pestañas; editar un mensaje inicia
un turno sin sus adjuntos anteriores. Citas inexistentes o ausentes generan
avisos, no evidencia inventada. No se verifica automáticamente que una conclusión
esté semánticamente respaldada. No se consultan servicios externos de favicons.

`attached-fragments` cierra observación automática, búsqueda y retrieval en
Gemini/OpenAI; sólo permite herramientas locales del workspace de la Skill
elegida, sin descarga de imágenes. Se aplica tanto al catálogo como al despacho.
Los extractos se guardan en la metadata existente del chat, con sus mismas
reglas de persistencia y acceso, también al compartirlo. No es E2EE ni una
garantía de privacidad de incógnito: adjuntar implica enviar al modelo y guardar
con el chat, efecto anunciado en el selector.

La preparación excluye dobles envíos y descarta resultados tras detener,
desmontar o cambiar contexto; no interrumpe físicamente un IPC ya emitido. La
cancelación end-to-end y supervisión CU están implementadas por separado; no
revierten entrada nativa que ya fue emitida.

Evidencia de implementación: [captura acotada](../../src/services/browser-tab-sources.ts),
[contrato de fragmentos](../../src/shared/browser-tab-context.ts) y
[procesamiento del turno](../../src/hooks/chat-processor/process-message.ts).

## Prueba visual aislada

`test/manual/browser-workspace/vite.config.mts` sirve controles reales con datos
ficticios y un puente en memoria, sin iniciar Electron ni cargar `.env`:

```powershell
npx vite --config test/manual/browser-workspace/vite.config.mts
```

Abrir `http://127.0.0.1:4318/`. Permite comprobar grupos, pestañas verticales,
teclado, edición/orden de marcadores, soporte y temas. Soporte usa versiones
ficticias y simula cancelación de exportación, sin guardar archivos. Las otras secciones son sólo
navegación visual del componente; la prueba no implementa sus bridges. No
valida red, particiones, diálogos nativos ni persistencia. Recargar restablece
los datos ficticios. Detener Vite al terminar.

El detalle de aceptación y evidencia vive en
[`complete-integrated-browser-platform`](../../openspec/changes/complete-integrated-browser-platform/tasks.md).
