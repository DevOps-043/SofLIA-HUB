# Estrategia e inventario de pruebas

Estado: vigente. Actualizado: 2026-10-22.

El inventario del cambio contiene 701 archivos de prueba: 464 para main y 231
para renderer, además de los archivos de prueba de scripts. El validador documental recalcula estas cifras; el numero de casos
ejecutados se registra en el reporte de evidencia de cada cambio, no aqui.

Actualizar las cifras mediante `npm run docs:inventory:sync`: deriva archivos
versionados y nuevos no ignorados de Git y modifica únicamente la declaración
de inventario. `npm run docs:system:check` y la compuerta mantienen validación
estricta sin escribir; si cambia el inventario, exigen sincronizarlo explícitamente.

<!-- evidence: vitest.config.ts -->
<!-- evidence: electron/__tests__ -->
<!-- evidence: src/__tests__ -->
<!-- evidence: electron/sqlite/database.ts -->

## Proyectos Vitest

Entrega Gmail: archivos reales temporales, rechazo completo de adjuntos
ausentes/ilegibles, enlaces finales, límites individuales/acumulados, crecimiento
durante lectura y cierre del handle. Compositor MIME real con Unicode/BCC y
copia autorizada inmutable; validación IPC de actor/frame, A/B/A, cancelación y
caducidad. Preload/wrapper conservan cancelación e incertidumbre sin retry.
La compatibilidad Nodemailer prueba exports CJS/ESM y servidor SMTP en loopback,
con verify, autenticación ficticia, envío y sobre BCC reales, sin credenciales
reales o correo externo.

Checkpoint del navegador: contratos de agrupación a 250 ms, captura tardía,
propagación de errores, espera de escrituras, estabilización de metadata,
reintento por perfil, reinicio y cancelación durante carga/escritura/limpieza.
La suite existente del servicio conserva recuperación, perfiles y pestañas
sensibles. `browser:smoke:native -- --electron RUTA_ABSOLUTA --lifecycle-only`
usa checkpoint y store reales con ventana oculta y perfil temporal; comprueba
beforeunload cancelado, reanudación de guardado y escritura antes de purgar.
No inicia el bootstrap ni acredita toda la aplicación instalada.

Custodia Workspace: archivos reales con cifrado de prueba, migración por dueño,
errores de escritura/rotación y ausencia de reimportación tras desconectar.
Los casos de sesión cubren A/B/A, OAuth/renovaciones tardíos, transporte del SDK
Google real con fetch simulado, consumidores Gmail/Drive/Chat y polling sin
solapamientos. `calendar:smoke:native` verifica DPAPI real en tres procesos
Electron con perfil temporal: cifrar/migrar, restaurar y desconectar sin
resurrección. No usa cuentas ni credenciales reales.

Build aislado: `app-build-smoke.test.ts` comprueba inclusión de las configuraciones
Vite auxiliares y las entradas exactas de Zoom, con rechazo de configuración local,
secretos y dependencias instaladas. `npm run app:smoke:build` ejecuta build:app
sin .env en un directorio temporal y exige artefactos de renderer/main/preload,
presentaciones, audiovisual y Zoom. No sustituye smoke del producto instalado.

Instalador: fuentes/entorno aislados, PE y SHA256, política NSIS, integridad de
BMP, pins Python, locks, promoción recuperable y hook de ambos sidecars tienen
pruebas focalizadas. `installer:smoke:win` genera y comprueba el paquete sin
iniciarlo; `scripts/quality/smoke-python-sidecars.mjs` prueba NDJSON real sin
audio/modelos. Las suites bajo `python/*/tests` usan un venv de QA separado;
pytest no se agrega al runtime distribuible. El caso XLSX concurrente verifica
que ping y lectura responden sin bloquear la inicialización nativa en Windows.

Conexiones Python: `python-sidecar-lifecycle.test.ts` reproduce propiedad entre
generaciones, ready compartido, stop/configuración durante startup, backoff
cancelado, agotamiento de arranque, respuesta/stop simultáneos y cuotas de
NDJSON/pending/stdin. Comprueba UTF-8 fragmentado, errores de transporte seguros
y guardas hasta close. Los tests de sesiones conservan dictado/Piper, y los de
tools mantienen contrato y opt-in de PII. `python-sidecar-process.test.ts` usa
hijos Node ficticios con tuberías reales para Unicode, timeout sin retry,
salida a mitad de petición y protocolo inválido. `python:smoke:connection` añade
Python real v4/v1 y conexión main compilada, sin audio/modelos; distingue runtime
de QA de distribuible. No certifica autorización IPC, grabación, parsers o RLS.

Atajos/configuración sync: biblioteca asíncrona, codec compatible, copia previa,
guardas, flush, revisiones/IDs nuevos, pausa sin red y limpieza de copias.
Negativos distinguen versión futura interior/exterior, ámbito ajeno, cuotas,
ausencia con copia y confirmación cancelada/tardía. La fase nativa `policies`
cubre ahora cinco stores y diez comprobaciones DPAPI; no acredita producto
completo ni despliegue remoto.

Passkeys y sitios de extensiones: suites de selección nativa, compilación del
manifiesto, huella/estado parcial, guardas del servicio, IPC y panel.
El runner nativo añade `--passkeys-only` (disponibilidad Windows, autenticador
virtual) y `--extensions-only` (Chromium real y sitios locales), sin instalar
extensiones de terceros ni utilizar credenciales reales. No acredita interacción
humana con el proveedor ni smoke del instalador.

Catálogo: huellas oficiales, actualización fallida/concurrente, permisos
conservados, sesión A→B→A, titular ajeno, cuatro capas IPC y panel con cancelación.
`--catalog-only` es una prueba opt-in con red: descarga siete archivos del ejemplo
oficial fijado, verifica SHA-256 y prueba carga/reinstalación en Electron aislado.
No instala en el perfil real ni es parte de la matriz sin red externa.
SQLite: fallos de creación/validación revierten DDL y versión; los tres stores
rechazan bases futuras, ajenas o incompletas preservando bytes. Permisos conserva
archivos ilegibles y bloquea escrituras, sin resucitar concesiones desde respaldos.

Recuperación de ajustes: corrupción/ausencia, versiones futuras, cuota, errores
de E/S, ámbito ajeno, revisión vencida, bytes cambiados, escritura/limpieza
fallida, carreras y barrera de flush. Las proyecciones retiran autoridad y
preservan bloqueos administrados. Servicio/IPC/panel verifican confirmación,
cancelación y sesión/perfil/control obsoletos. `--policies-only` ejecuta los tres
stores en Electron real con DPAPI; no simula la protección del SO ni utiliza
perfiles reales. El diálogo de producto sigue cubierto con dobles, no humano.

Voz, memoria semántica, formularios sensibles, sesión SO y zoom tienen suites
dirigidas main/renderer, contrato IPC, rechazo de entradas, cancelación y cambios
de contexto. Las sondas DOM se prueban con JSDOM (sin layout real); proveedor de
embeddings y autenticación interactiva usan dobles. El runner nativo
`scripts/quality/smoke-browser-native.mjs` añade `--zoom-only` y amplía
`--autosave-only`: ejecuta el código real en Electron con páginas y cuentas
ficticias, sin bootstrap, perfiles reales ni secretos. No reemplaza smoke de
producto/instalador ni verificación interactiva de Windows Hello.

Supervisión visual: `browser-cu-supervision.test.ts` ejecuta el loop real con
dobles de modelo/driver para pausa, drenaje, captura fresca, presupuesto y cierre.
`BrowserAgentTaskControls.test.tsx` y `BrowserAgentPolicyPrompt.test.tsx` verifican
estados autoritativos, escalada a detención, acuses obsoletos y retiro de avisos.
Servicio, handler, preload y wrapper cubren aislamiento y contrato. No sustituyen
el smoke Windows de 9.5 ni prueban una petición real al proveedor.

Atajos de lectura: `integrated-browser-agent-shortcuts.test.ts` verifica store
protegido, cuota, revisión, corrupción, versión futura, commit y consentimiento.
`BrowserAgentShortcutsPanel.test.tsx` cubre creación/edición, elección sin envío,
cancelación, error y descarte tras cambio de perfil; `browser-shortcut-turn.test.ts`
rechaza ampliar permisos, fuentes o contexto. Handler, preload y wrapper cubren
el contrato. El doble global de safeStorage no cifra: esta evidencia demuestra
cableado, no una prueba criptográfica ni smoke nativo de la biblioteca.

Cancelación visual: `desktop-agent-computer-use-lifecycle.test.ts` comprueba
registro durante apertura, estado/ID, aborto general/específico, exclusión,
limpieza y cola. `gemini-cu-loop.test.ts` y `gemini-cu-client.test.ts` cubren
esperas que no responden, señal del SDK y respuestas/errores tardíos.
`integrated-browser-service.test.ts` verifica viewport cancelado, navegación
evaluada tardíamente y reserva hasta drenar navegación nativa. Usa dobles;
no sustituye pruebas del producto instalado ni del servicio remoto del modelo.

Fuentes de pestañas: `browser-tab-sources.test.ts` verifica lectura fresca,
cuotas, perfiles, documento, plazo, cancelación y redacción de URL;
`attachment-preparation.test.tsx` cubre exclusión/cambio de contexto;
`BrowserTabSources.test.tsx` y `ChatInputArea.test.tsx` cubren selección `@`,
teclado y evidencia. Los casos de procesamiento/rutas del chat verifican
metadata al reabrir/regenerar, ausencia de lecturas implícitas y herramientas
limitadas a la Skill. Servicio, handler, preload y wrapper conservan regresión
propia. Son pruebas automatizadas con dobles, no smoke del producto instalado.

| Proyecto | Entorno | Include | Setup |
|---|---|---|---|
| `main` | Node | `electron/__tests__/**/*.test.ts` | `test/setup-main.ts`, alias Electron a mock |
| `renderer` | jsdom | `src/__tests__/**/*.test.ts(x)` | `test/setup-renderer.ts` |

Timeout de test y hook: 15 segundos. Los tests que prueban timeouts mayores deben
usar clocks/mocks o justificar override local, no aumentar el global sin evidencia.

## Tipos de evidencia existentes

- Unit: normalizadores, helpers, policies, schema y estados.
- Integration in-process: servicios con SQLite temporal, handlers y dispatchers.
- Renderer: componentes/hooks con Testing Library y jsdom.
- Source/contract: presencia de controles preload, canales, scripts y formatos.
- Build: TypeScript y bundles main/preload/renderer.
- Release: artifacts por OS y smoke de AppImage Linux.

No hay suite E2E empaquetada que automatice Windows/macOS completos ni proveedor
real de WhatsApp/Google/Supabase/Gemini. Dobles locales no sustituyen pruebas de
contrato en entorno autorizado.

### Skills y presentaciones

La verificación del motor base cubre el lienzo limitado a la ventana, el ajuste
en un marco de altura visual explícita sin espacio fantasma, el mayor factor que cabe, la coreografía
semántica con Web Animations, el estado final con movimiento reducido y el informe local para contenido fuera del lienzo,
imágenes rotas, titulares largos y diapositivas activas sin contenido visible.
El contrato actual separa autoría y render: el agente solo escribe `deck.json`;
el esquema limita densidad, rutas, arquetipos, variantes, paletas accesibles y
vocabulario de movimiento. El
reproductor React conserva un lienzo lógico 1920×1080 y el servidor loopback
solo sirve recursos allowlisted mediante una sesión opaca. El contrato del
prompt fija además arquitectura narrativa, evidencia por diapositiva,
composición editorial en vez de dashboards de tarjetas, prioridad cromática
`usuario > fuente > organización > neutro` y revisión en 16:9 y movimiento
reducido.

El bucle verifica el estado autoritativo antes de aceptar un cierre: si falta
un `deck.json` valido, reinyecta la reparacion y no muestra un exito falso. Los
workspaces React nuevos solo reciben `estilos/marca.css`; `base.css` y
`guion-base.js` quedan limitados a workspaces HTML heredados.

| Suite | Qué demuestra |
|---|---|
| `src/__tests__/services/workspace-completion.test.ts` | La condicion de salida autoritativa: Presentaciones exige un workspace listo, otras Skills no quedan acopladas y la ausencia de `deck.json` produce una reparacion en vez de un exito aparente. |
| `src/__tests__/shared/presentation-deck-schema.test.ts` | El contrato declarativo acepta los nueve arquetipos, incluida `grafica` con series alineadas, y rechaza ids repetidos, densidad excesiva, rutas fuera de `assets/`, tipos desconocidos, paletas sin contraste y firmas visuales repetidas; los decks antiguos sin variante siguen siendo compatibles. |
| `electron/__tests__/presentation-runtime-server.test.ts` | El servidor React usa loopback y token opaco, valida el deck antes de abrir, sirve únicamente bundle/contrato/marca/recursos y rechaza archivos arbitrarios del workspace. |
| `electron/__tests__/skill-workspace-paths.test.ts` | Contención de rutas contra el sistema de archivos real: `..`, ruta absoluta externa, enlace simbólico hacia fuera, carpeta enlazada hacia fuera y hermano con prefijo común. El caso del symlink no se reproduce con rutas simuladas, por eso la suite escribe en disco. |
| `electron/__tests__/skill-workspace-service.test.ts` | El diagnostico de una edicion fallida, que es lo que evita quince reintentos identicos: avisa si el fragmento existe con otro formato, devuelve el contenido real de alrededor, manda releer cuando no hay rastro y dice en que lineas esta el fragmento ambiguo. Ademas: límites por archivo, por workspace y de extensión; edición por reemplazo exacto con sus tres desenlaces (único, inexistente, ambiguo); archivos protegidos que el modelo no puede reescribir, editar ni borrar; actualización silenciosa e idempotente de un protegido solo por el sistema; ausencia de archivos parciales tras un fallo; eventos de progreso y error por archivo; y las imágenes, que entran por una vía propia: destino forzado a `assets/`, nombre saneado aunque traiga ruta, formato restringido y presupuesto respetado. |
| `electron/__tests__/integrated-browser-page-observation.test.ts` | Acotado del payload, URL sin credenciales y ausencia de valores de formulario; y las imagenes de contenido, que conservan su query a proposito (sin ella la descarga devuelve 403) pero pierden las credenciales y descartan `data:`, `blob:` y lo que no sea una URL. Ademas la eleccion de backend: el recorrido en script es el predeterminado, la lectura ocurre en el mundo aislado y no en el contexto de la pagina, y una sesion CDP no disponible cae al script en vez de dejar al agente sin observacion. |
| `electron/__tests__/integrated-browser-agent-world.test.ts` | El aislamiento de lo que el agente ejecuta en la pagina: usa el mundo dedicado cuando existe, el identificador no colisiona con el mundo del contenido ni con el de `contextIsolation` de Electron, cae al mundo principal solo cuando el destino no expone la API, y un fallo del mundo aislado **no** se reintenta en el principal —hacerlo devolveria el registro de elementos a la vista del sitio—. |
| `electron/__tests__/integrated-browser-cdp-session.test.ts` | El ciclo de vida de la sesion de inspeccion, que admite un solo cliente por pestaña: habilita el dominio una vez y lo suelta al terminar, libera aunque el trabajo falle, no cierra la sesion que otro consumidor sigue usando (el fallo que motivo el modulo), degrada con `CdpUnavailableError` cuando DevTools ya la tiene o un dominio no engancha, olvida el estado cuando Chromium la cierra por su cuenta, y no envia comandos sobre una pestaña destruida. El arrendamiento persistente ademas: mantiene la sesion hasta soltarla, reparte eventos solo al metodo suscrito y deja de hacerlo tras soltar, avisa cuando DevTools se lleva la sesion, tolera que se suelte un arrendamiento ya perdido sin desbalancear el contador, comparte conexion con una captura puntual simultanea y engancha el despacho una sola vez por pestaña. |
| `electron/__tests__/integrated-browser-dom-marks.test.ts` | La fuente de marcas del Set-of-Marks del navegador: numeracion en orden de lectura agrupando por filas con tolerancia vertical —dos botones de la misma barra a `y` distinta son la misma fila—, conservacion del `ref` para resolver el clic sin pixeles, descarte de lo deshabilitado, lo diminuto y lo que quedo fuera del area visible, fusion de cajas superpuestas, tope de 30 con renumeracion sin huecos, y traduccion de rol/etiqueta/tipo al vocabulario de color. Ademas la escala a la captura reducida y el rechazo de un viewport degenerado en vez de dividir por cero. |
| `electron/__tests__/integrated-browser-cu-marks.test.ts` | El cableado del marcado en el driver de Computer Use: apagado por omision para poder medir con el mismo binario, captura intacta con el flag apagado, traduccion del rectangulo del viewport a los pixeles de la captura reducida, ausencia de marcas con menos de tres controles, y captura limpia si el dibujado falla. Fija tambien que la observacion almacenada no se contamina: esa imagen alimenta el respaldo visual del renderer y los adjuntos del chat. |
| `electron/__tests__/integrated-browser-bootstrap.test.ts` | El arranque del mundo del agente en cada documento: registra el guion en el mundo con nombre y con `runImmediately` —sin el, la pagina ya abierta se quedaria sin mundo—, abre el puente, entrega el aviso junto al marco que lo emitio, ignora contextos de otros mundos y mensajes ajenos al puente, y descarta cargas utiles no confiables (JSON invalido, tipo desconocido, exceso de tamaño) sin romper el reparto. La politica frente a DevTools: cede la sesion y avisa de la degradacion en vez de fallar, se reinstala al liberarse, degrada sin lanzar si DevTools ya la tenia al arrancar, no duplica instalaciones simultaneas y retira guion, puente y sesion al desmontar. |
| `electron/__tests__/integrated-browser-cdp-dom-snapshot.test.ts` | La traduccion de `DOMSnapshot.captureSnapshot` al contrato de observacion: encabezados, landmarks y viewport; query fuera de la URL de pagina pero dentro de la de imagen; contraseña nunca expuesta; referencias por `backendNodeId`; lectura del iframe del mismo proceso con sus coordenadas trasladadas al viewport de la pestaña; omision de lo que no llega a la composicion; y `null` ante una captura vacia para que el llamador use el backend en script. |
| `electron/__tests__/integrated-browser-element-resolution.test.ts` | El enrutado de las dos familias de referencia: `dom-N` se resuelve en el mundo aislado y `cdp-N` por `backendNodeId`, liberando siempre el manejador para no retener el nodo. Cubre la referencia malformada que no llega a abrir sesion, el nodo desaparecido, la sesion no disponible, y el marco de otro origen, que falla con mensaje accionable en vez de señalar una coordenada equivocada. |
| `electron/__tests__/skill-workspace-fetch-image.test.ts` | Guardas de la descarga de imágenes, que ejecuta main porque la URL la elige el modelo: solo HTTPS, rechazo de destinos privados y de enlace local **sin emitir la petición**, revalidación de cada redirección (una URL pública que redirige a `169.254.169.254` se corta), cadena de redirecciones acotada, tipo no admitido, límite de tamaño y error de red que no filtra el destino interno. |
| `electron/__tests__/presentation-protocol.test.ts` | El protocolo local solo sirve el workspace indicado, devuelve 404 fuera de la raíz, ante un symlink externo y ante una extensión sin tipo conocido, emite una CSP sin `connect-src` ni orígenes remotos, y registra el handler en **ambas** sesiones: la del renderer y la partición de la vista a pantalla completa. |
| `electron/__tests__/deck-base-css.test.ts` | El sistema de diseno y el guion base, que salen en TODAS las presentaciones: pie en flujo, marco sin deriva vertical ni `zoom`, preservación de alineación y ancho al envolver contenido, contraste automático sobre imagen de fondo, primitivas de diagrama y gráfica, coreografía semántica con Web Animations al activarse la diapositiva, ajuste del contenido a la ventana y estado final con movimiento reducido. |
| `electron/__tests__/presentation-system-refresh.test.ts` | Una baraja persistida con el motor antiguo recibe los protegidos actuales antes de vista previa, pantalla completa o exportación; la operación es idempotente y rechaza un identificador vacío. |
| `electron/__tests__/presentation-export-html.test.ts` | La exportación produce un HTML autocontenido. Cubre tanto HTML heredado como el runtime React: incrusta bundle, contrato, marca e imágenes, conserva módulos, descarta orígenes remotos y no incrusta archivos de fuera del proyecto. |
| `electron/__tests__/organization-branding.test.ts` | Tema neutro sin organización o sin branding habilitado; rechazo de colores que no son colores CSS; ausencia de columnas de suscripción o contacto en la consulta; caché con invalidación por cambio de organización y cierre de sesión; descarga acotada por host, tamaño, timeout y tipo declarado. |
| `electron/__tests__/wa-skills-catalog.test.ts` | Skill no habilitada para la superficie, skill bloqueada en grupos y skill desconocida se rechazan con motivo explícito y sin filtrar la conversación individual. Y desde que el catálogo vive en la base de datos: WhatsApp resuelve la misma fila que el chat con el mismo acotado, una fila deshabilitada la retira en las dos superficies, una fila que acota superficies retira la del código, y sin base de datos se resuelve el respaldo. |
| `src/__tests__/services/system-skills-catalog.test.ts` | El acotado de lo que una fila del catálogo declara, que es lo único que hace segura la decisión de guardarlo todo en la base de datos: raíz absoluta o con `..` descartada, extensiones intersecadas con las admitidas, límites de bytes topados, archivos del sistema siempre protegidos, y `use_computer`/`execute_command`/`delete_item` descartadas aunque la fila las pida. Además la tabla de fusión completa (fila manda, `enabled:false` retira, ausencia respeta el código, fila ilegible no retira nada, versión insuficiente ignora la fila) y el viaje de ida y vuelta de la semilla, que debe volver idéntica. |
| `src/__tests__/services/skills-catalog-remoto.test.ts` | El catálogo efectivo del chat: se resuelve desde las filas, un fallo de lectura conserva las Skills de la versión instalada, una fila deshabilitada las retira, y las guardas de identidad siguen en pie —una Skill de usuario con identificador `sistema:` se descarta y un comando en conflicto resuelve a la del sistema—. |
| `electron/__tests__/whatsapp-workflow-presentacion.test.ts` | El flujo usa el motor propio, escribe la hoja de marca como sistema, entrega el PDF solo tras la aprobación y no llama a ningún generador externo. |
| `src/__tests__/services/gemini-chat-streams.test.ts` | Las dos diferencias del SDK nuevo que rompen el turno en silencio si se revierten: `text` es un descriptor de acceso y no un método —una prueba falla si el código lo invoca como función—, y las fuentes solo pueden resolverse al terminar el stream, incluido el camino en que el usuario cancela y abandona el generador a medias, que sin esto dejaba `await result.sources` colgado para siempre. |
| `src/__tests__/services/multimodal-message-content.test.ts` | El constructor de partes: las cuatro rutas de transporte, el recorte de ventana a los límites reales del medio (posición anterior al inicio, posterior al final, posición desconocida), los rechazos con motivo, y la degradación **ordenada** ante presupuesto excedido —baja resolución, luego acorta ventana conservando el instante actual, y solo entonces excluye—. El caso de exclusión se prueba con audio porque es el único medio sin ventana que recortar. |
| `electron/__tests__/media-input-service.test.ts` | El ciclo de la subida: procesamiento que completa, procesamiento que no termina y aborta con su estado sin colgar el turno, cancelación que suelta el archivo remoto ya creado, formato y tamaño rechazados antes de transferir, archivo desaparecido, referencia caducada, liberación, y el saneamiento del error, que no debe dejar pasar ni la clave del proveedor ni la ruta local. |
| `electron/__tests__/browser-capture-quality.test.ts` | La detección de evidencia no utilizable, que es lo que impide describir una escena no observada: un cuadro negro de reproducción protegida y uno blanco plano se rechazan por desviación típica, la captura vacía se declara aparte, y la resolución de video público normaliza las formas de YouTube descartando destinos autenticados e identificadores con forma inválida. |
| `src/__tests__/services/browser-vision-tools.test.ts` | Las dos herramientas de visión bajo una sola regla: SofLIA no describe lo que no llegó. Cuadro fresco sin reutilizar la observación pasiva; DRM que devuelve `evidencia: no-disponible` con prohibición explícita de describir; video público por URI acotado a la posición de reproducción; degradación a muestreo **declarado** como muestreo; posición desconocida que arranca del inicio y lo dice; ventana que nunca supera el máximo; y ausencia de interacción con la página. |
| `src/__tests__/services/media-attachments.test.ts` | Los límites del compositor con su motivo concreto: formato no admitido que enumera los admitidos, archivo sobre el límite del proveedor que dice su tamaño, tope de adjuntos por turno, duración combinada, umbral de subida frente a envío incrustado, y el turno que espera a que ningún adjunto siga en vuelo. |
| `src/__tests__/services/ambient-audio.test.ts` | Las guardas de la escucha: el modelo no puede iniciarla sin petición del usuario, la fuente no disponible se declara y ofrece el micrófono, el permiso denegado por el sistema operativo se distingue del fallo genérico, la detención explícita libera el dispositivo, y cancelar el turno descarta el audio. Más el encapsulado WAV, que debe declarar mono 16 kHz y acotar las muestras fuera de rango. |
| `src/__tests__/services/chat-prompt-browser-vision.test.ts` | Las cláusulas del prompt que sostienen la doctrina de evidencia: la distinción entre captura y video real, la prohibición de pedir la transcripción teniendo la ruta de video, la prohibición de describir lo que no llegó al turno, y la obligación de declarar cuando la evidencia es un muestreo. |
| `src/__tests__/services/turn-skill-tools.test.ts` | La cadena completa desde "la conversacion tiene una presentacion" hasta "el modelo recibe `workspace_write_file`": deriva la Skill del espacio de trabajo cuando el compositor la perdio, declara las herramientas, corre el bucle, completa el workspace de una Skill recien activada y no declara nada sin presentacion. Cada eslabon estaba bien por separado; lo que fallaba era la union, y el usuario lo vio tres veces como "no puedo acceder a los archivos". |
| `src/__tests__/services/skills-turn-catalog.test.ts` | Sin Skill activa el catálogo es idéntico al base; con workspace vivo se declaran las herramientas; sin workspace no; la allowlist de superficie descarta lo que una Skill no puede aportar. |
| `src/__tests__/components/PresentationWorkspacePanel.test.tsx` | Una imagen se muestra como imagen y NUNCA se pide como texto (leerla bloqueaba la aplicacion); se abre el documento de entrada y no la primera imagen; edicion manual que guarda por el puente, con los archivos del sistema sin boton de editar; y la exportacion abre la carpeta. Ademas: listado y selección de archivos, señal del archivo en curso, error por archivo, progreso de otro workspace ignorado, reproducción deshabilitada hasta que existe el documento, `iframe` sin `allow-same-origin`, conexión de la medición antes del cambio no-lista → lista, ancho ajustable con teclado y persistido con sus límites, y apertura automática de la vista previa al terminar sin arrebatársela al usuario después. |
| `src/__tests__/presentation-runtime/PresentationPlayerApp.test.tsx` | El runtime React pinta una gráfica declarativa con semántica accesible, aplica una paleta de fuente dentro del lienzo, rellena imágenes contenidas sin bandas planas y bloquea pulsaciones consecutivas durante una transición para que una acción avance exactamente una diapositiva. |
| `src/__tests__/components/presentation-code-highlight.test.ts` | Resaltado por lenguaje, escapado del marcado del contenido en los tres lenguajes (se pinta con `dangerouslySetInnerHTML`) y cota de tamaño que evita tokenizar un archivo desproporcionado. |
| `src/__tests__/services/renderer-csp.test.ts` | La CSP del renderer permite embeber `pulse-presentacion:` y no abre el embebido a orígenes remotos. Sin `frame-src` explícito la directiva caía a `default-src 'self'` y la vista previa quedaba en blanco. |
| `src/__tests__/services/presentaciones-prompt.test.ts` | El agente recibe el contrato `deck.json`, la frontera HyperFrames/React/Tailwind/Framer Motion, los límites de densidad, la prioridad de paleta, la variedad de firmas visuales y la prohibición explícita de escribir HTML, CSS o JavaScript visual. |
| `src/__tests__/services/presentation-source-visuals.test.ts` | La importación previa al modelo solo corre para `sistema:presentaciones`, deduplica adjuntos, prioriza imágenes web pertinentes, entrega rutas locales en un manifiesto y degrada por recurso sin perder los visuales válidos. |
| `src/__tests__/services/tool-result-payload.test.ts` | La frontera entre lo que devuelve una herramienta y lo que entra al contexto: la captura sale del texto y se entrega como imagen dejando constancia de que existe, el campo mas pesado se descarta primero diciendo cuanto omitio, un resultado que ya cabe no se toca, y la salida es siempre JSON de objeto (quien la consume la parsea). |
| `src/__tests__/services/openai-workspace-turn.test.ts` | Lo que hacia morir el turno que construye una presentacion: un 429 al abrir el stream ahora se reintenta (y lo que no es transitorio, no), el contenido ya escrito deja de reenviarse en cada iteracion conservando la ruta, los argumentos pequenos quedan intactos, y el turno con workspace vivo recibe mas iteraciones y mas presupuesto de salida que uno de chat. Cubre tambien el 429 que llega LEYENDO el stream (no al abrirlo) y que no se reintenta si ya hubo texto en pantalla, la captura que viaja como imagen y no dentro del JSON de la salida, el descarte de las capturas antiguas y el recorte de los resultados de herramienta antiguos, que es lo que agotaba los tokens por minuto de la organizacion. |
| `src/__tests__/services/skill-workspace-image-tools.test.ts` | Reparto entre renderer y main para las imágenes: el renderer genera y entrega solo base64 (el prefijo `data:` rompería la decodificación en main), no escribe nada si el modelo no devolvió imagen, valida los argumentos antes de gastar una generación, y delega la descarga sin intentar validar la URL por su cuenta. |
| `src/__tests__/components/skill-workspace-resume.test.tsx` | Una conversacion que ya tiene entregable recupera su Skill sola, con la nota de que continua un trabajo; no pisa una Skill activa, no se reimpone si el usuario la desactiva y no falla fuera del escritorio. Sin esto, pedir un cambio sobre la presentacion llegaba al modelo sin herramientas de workspace y respondia que no tenia acceso a los archivos. |
| `src/__tests__/components/SkillLibrary.test.tsx` | Separación entre Skills del sistema y del usuario; las del sistema no ofrecen editar ni eliminar. |
| `electron/__tests__/brand-palette.test.ts` | Extracción de paleta desde el bitmap del logo: color dominante, varios colores por frecuencia, descarte de fondo blanco, negro y píxeles transparentes, logo monocromo sin paleta, agrupación del antialiasing y corrección de contraste sobre fondo claro. |
| `src/__tests__/services/skill-slash-commands.test.ts` | Derivación del comando desde el nombre, comando declarado por la Skill del sistema, precedencia ante duplicados, filtrado por prefijo, coincidencia exacta con y sin acento, y que un texto con espacio deja de ser comando. |
| `src/__tests__/components/SkillsSettingsPanel.test.tsx` | Configuración de Skills: listado con comando, Skills del sistema sin acciones de edición, derivación del comando desde el nombre, aviso y rechazo de comando duplicado, validación de campos obligatorios, creación con icono y comando, y que al editar el comando propio no cuenta como conflicto. |
| `src/__tests__/services/skill-tool-loop.test.ts` | La decisión de activar el bucle de herramientas: una Skill que declara herramientas lo fuerza incluso sobre una observación de solo lectura del navegador, y sin Skill ese caso sigue sin bucle. |
| `src/__tests__/components/ChatInputArea.test.tsx` | El menú de comandos aparece solo con un comando en curso y va en flujo normal, para que el `overflow-hidden` del compositor no lo recorte. |

## SQLite sin ABI nativa

`npm run test` ejecuta Vitest directamente. La persistencia local usa
`node:sqlite`, incluido en el Node que trae Electron, asi que no hay extension
compilada contra la ABI de V8 que reconstruir entre Node y Electron. El
adaptador vive en `electron/sqlite/database.ts` y los errores
`NODE_MODULE_VERSION` de `better-sqlite3` dejaron de ser posibles.

## Piramide por tipo de cambio

| Cambio | Evidencia minima adicional |
|---|---|
| UI | component/hook + teclado/estados manuales + claro/oscuro |
| IPC | handler, preload allowlist, wrapper y casos canal/payload invalido |
| Tool/agente | schema, autorizacion, HITL, group, timeout, loop y redaccion de error |
| Datos | SQL lint/revision, constraint/RLS, migracion forward, preflight y rollback |
| Integracion | no configurada, exito mock, 401/403, 429, 5xx, timeout y desconexion |
| Release | `verify:release`, recursos empaquetados y artifacts esperados |
| Documentacion/arnes | adapters/harness/docs/OpenSpec/link checks |

## Compuertas

- Durante desarrollo: prueba dirigida con `npx vitest run <archivos>`.
- PR: `npm run verify:pr`.
- Release: `npm run verify:release`.
- `lint:changed` bloquea errores solo en TS/TSX modificados; `lint` global puede
  revelar deuda no atribuible y sigue siendo diagnostico util.

## Casos negativos obligatorios

Autenticacion ausente, org/owner equivocado, input extra, canal no allowlisted,
grupo bloqueado, HITL ausente/falsificado, contrato cambiado, timeout/abort,
respuesta parcial, idempotency replay, DB no disponible, provider rate limit y
rollback. No todos aplican a cada cambio; el Context Pack decide.

### Contexto de aplicaciones de escritorio

| Suite | Qué demuestra |
|---|---|
| `electron/__tests__/desktop-context-inventory.test.ts` | Que listar es barato y acotado: cruce de ventanas con miniaturas, exclusión de Soflia Hub por pid y por título, descarte de ventanas sin título, inventario vacío ante fallo de enumeración, identificador estable entre inventarios y degradación a solo captura fuera de Windows. |
| `electron/__tests__/desktop-context-cascade.test.ts` | La degradación de la cascada, que es donde se decide la fidelidad: documento completo con tablas y visual de apoyo, conservación del documento si falla esa captura, marca de cambios sin guardar, caída a accesibilidad cuando el documento no está en disco o la ruta no corresponde a la ventana marcada, caída a captura sin texto accesible, fallo aislado y truncado declarado. |
| `electron/__tests__/desktop-context-handlers.test.ts` | Que el contrato IPC no deja rutas abiertas: solo dos canales, rechazo de emisor ajeno, rechazo de identificador no inventariado sin devolver contenido, ausencia de registro con la capacidad desactivada y saneamiento de rutas del disco en los errores. |
| `src/__tests__/services/app-attachments.test.ts` | Que el bloque de contexto no engaña al modelo: procedencia por nivel, documento completo acompañado por su visual actual, aviso de cambios sin guardar, acotado de la autoridad de una captura, prohibición de inferir cuando no hay contenido, recorte declarado y fallo aislado. |
| `src/__tests__/components/AppAttachmentPicker.test.tsx` | El selector y el chip: nivel previsto por aplicación, estado vacío explícito, reintento tras fallo, ausencia de la capacidad, y el chip declarando fidelidad real y avisos antes de enviar. |

### Sincronización y dispositivos del navegador

| Suite | Qué demuestra |
|---|---|
| `electron/__tests__/integrated-browser-sync-conflicts.test.ts` | Tres vías por tipo, diferencias por campo/ID/borrado, cuotas sin truncar, orden estable, URLs saneadas y decisiones ligadas a una revisión. |
| `electron/__tests__/integrated-browser-sync-conflict-store.test.ts` | Reapertura con decisiones, cola compartida, aislamiento de perfil, corrupción, error de E/S, contexto obsoleto, rebase tras CAS y conservación hasta commit. Usa disco temporal y doble del almacén del SO, no Auth/UI/servidor reales. |
| `electron/__tests__/integrated-browser-sync-devices.test.ts` | Endpoints cerrados, verificación Auth, cuerpos y plazos acotados, backoff, idempotencia, cancelación, identidad protegida, corrupción conservada, consentimiento y revocación. HTTP/safeStorage simulados y disco temporal real; no demuestra PostgREST desplegado. |
| `electron/__tests__/integrated-browser-sync-auth.test.ts` | Factory aislado: sesión no anónima vigente, correspondencia del titular, verificación Auth, logout/cambio de session_id, refresh del mismo contexto, cancelación y liberación del listener. No carga configuración real ni llama servicios externos. |
| `src/__tests__/components/BrowserSyncPanel.test.tsx` | Estado deshabilitado, cancelación, registro/listado/revocación, reintento tras error y descarte de respuestas al desmontar. El texto distingue dispositivos de transferencia de datos aún pendiente. |

Las suites de servicio, handlers, preload y wrapper comprueban además marco
principal, payload cerrado, errores saneados y separación de secretos. La
verificación con dobles no acredita diálogos nativos ni dos equipos reales.

### Borrado de datos de navegacion

| Suite | Qué demuestra |
|---|---|
| `electron/__tests__/integrated-browser-browsing-data.test.ts` | Lo que decide si el usuario entiende lo que borró: cada rango traducido a un inicio concreto, rechazo de categoría e intervalo desconocidos y de lista vacía, la marca `ignoredRange` en las categorías que no pueden acotarse por fecha y su ausencia cuando el intervalo ya era "desde siempre", que solo se tocan las categorías pedidas, y el fallo aislado de una categoría con error saneado sin impedir el resto. |
| `electron/__tests__/browser-history-clear-range.test.ts` | El único borrado que sí respeta el intervalo, contra el sistema de archivos real: conserva lo anterior al inicio, quita lo posterior, incluye la visita justo en el límite, borra todo con rango nulo, devuelve cero sobre un historial vacío y rechaza una fecha inválida **antes** de escribir. |
| `electron/__tests__/integrated-browser-history-importer.test.ts` | Selección y cancelación sin escritura, resumen sin URLs ni rutas, deduplicación, visitas existentes, JSONL y `last_visit_time` de Chromium, límites de tamaño/entradas, contexto obsoleto y guardia contra importaciones simultáneas. |
| `src/__tests__/components/BrowserPrivacyPanel.test.tsx` | Que la interfaz no miente sobre el alcance: selección inicial equivalente a Chrome, confirmación obligatoria antes de cualquier llamada, payload exacto de categorías e intervalo, aviso de alcance solo cuando hay discrepancia real, resumen distinguiendo conteo de "sin acotar al intervalo", fallo aislado visible y error del canal sin dejar el diálogo colgado. |

### Acciones sobre el texto seleccionado

| Suite | Qué demuestra |
|---|---|
| `electron/__tests__/integrated-browser-selection-menu.test.ts` | El menú flotante inyectado en la página, sobre jsdom: las cinco acciones publicadas, que aparece anclado sobre la selección al terminar el gesto —sin clic derecho—, que el clic conserva la selección viva para que main pueda leerla, que se retira al deseleccionar y con Escape, que se apaga mientras el agente conduce, que reinstalar no lo duplica y que el aviso de consola solo acepta las acciones publicadas. |
| `electron/__tests__/integrated-browser-context-menu.test.ts` | La otra entrada a las mismas acciones: opciones según haya selección o no, recorte del adjunto de chat frente al límite mayor del lector, y que preguntar a SofLIA no precarga instrucción. |
| `electron/__tests__/integrated-browser-writing-panel.test.ts` | El panel de redacción sobre jsdom: que el menú lo abre sin mandar nada al chat, que la petición se entrega una sola vez, que la propuesta se escribe con `insertText` en el campo editable y, cuando el origen no lo era, en el compositor de la página, que un fallo del modelo se ve sin cerrar el panel, que con la propuesta a la vista el compositor se retira y reintentar lo devuelve con lo escrito antes sin volver a pedir solo, que una respuesta tardía ya no encuentra destinatario, y que el control del agente lo cierra. |
| `src/__tests__/services/browser-writing.test.ts` | El único punto donde el texto de una página entra a un modelo: que el fragmento y la instrucción del usuario van etiquetados como datos —una selección que dice "ignora todo lo anterior" sigue siendo material a reescribir—, que sin instrucción se pide una mejora conservadora, que se retira el andamiaje del modelo y que una respuesta vacía se declara como fallo. |

### Guardado manual de credenciales

Las suites `integrated-browser-storage`, `integrated-browser-service`,
`integrated-browser-handlers`, `preload` e `IntegratedBrowserPanel` verifican
revisión sin escritura, reemplazo/cancelación, vencimiento, concurrencia,
IDs ajenos, Unicode al límite, JSON dañado, fallos de rename, contexto obsoleto,
control del agente, frame principal, contratos cerrados, redacción de errores,
limpieza del campo y ausencia de éxito falso. Disco real temporal y dobles de
Electron no demuestran Windows Hello ni funcionamiento en el instalador.
Evidencia en el [reporte de guardado manual](../../openspec/changes/complete-integrated-browser-platform/reports/verification-credential-save-2026-09-05.md).

## Cobertura y deuda

La continuación de [limpieza efímera y avisos de navegación](../../openspec/changes/complete-integrated-browser-platform/reports/verification-profile-cleanup-and-safety-ui-2026-09-06.md)
registra pruebas de cierre cancelado, colas tardías, reapertura, limpieza fallida
y avisos por pestaña sin dictámenes obsoletos. El smoke nativo de lifecycle usa
Electron estable real, pero no equivale a ejecutar todo el producto empaquetado.

- La configuracion tiene comando de coverage, pero no umbral global ni por modulo.
- No hay mutation testing, axe, visual regression ni performance budget en CI.
- Tests por inspeccion de source son utiles para invariantes, pero no sustituyen
  ejecutar el comportamiento.
- Nombres legacy AutoDev en tests no demuestran servicio runtime activo.
- Cada reporte debe separar fallo introducido, fallo preexistente y gate no
  ejecutado; nunca convertir warnings en “todo aprobado”.

## Reducción de deuda: calendario y tooling

Las suites `whatsapp-tool-history`, `whatsapp-tool-observation`,
`whatsapp-tool-telemetry` y `whatsapp-tool-failures` comprueban campos cerrados,
disco temporal real, lectura legacy sin reescribir, búsqueda sin payload,
normalización idempotente, huellas privadas por turno y avance de contadores.
Se fuerza fallo síncrono/asíncrono de history después de efectos y se conserva
resultado/trace sin repetir ejecución. La suite del executor fuerza excepciones
de guardas, dispatch y fallback con mensajes privados ficticios; verifica error
fijo/correlación y continuidad. Los resultados normales de dominio permanecen
intactos y las guardas de repetición mantienen regresiones propias. No hay
perfiles, mensajes ni credenciales reales en estas pruebas.

`gmail-runtime-feedback.test.ts` reproduce el fallo con servicio Gmail,
ejecutor Google, loop y adaptador Responses reales, aislando guardas de
ejecución/historial y transporte del proveedor mediante dobles. Comprueba que una
modificación no consulta los demás mensajes ni fabrica resultados adicionales,
incluso tras cambiar cuenta, y conserva conteos/flags y call_id. La guarda de
intención se ejecuta; grupos/HITL se verifican en la suite de executor existente.
`google-executor-results` cubre paginación informativa, flags inválidos sin
coerción, errores saneados y servicios hermanos. `wa-openai-session` verifica
extras rechazados sin alterar pending, cierre de llamadas bloqueadas y rechazo
de lotes inválidos sin publicar un prefijo. No hay proveedor, correo ni WhatsApp
reales; estas pruebas no equivalen a una auditoría semántica del modelo.

Las suites de buzón `gmail-mailbox-operations`, `gmail-mailbox-ipc`,
`gmail-mailbox-sdk` y el wrapper renderer comprueban selección paginada antes de
mutar, IDs únicos aun conservando origen, preflight fallido sin efectos, cuotas,
mensajes nuevos, referencias ambiguas, conteos tras fallos de lote/borrado y
aislamiento de lectura. Los nueve handlers y seis confirmaciones se ejecutan
con dobles; el SDK real usa fetch local simulado para 503 sin retry y abort antes
del transporte. No se accede a un buzón remoto ni se acredita un modal nativo
con interacción humana. Planes, envío y custodia conservan regresiones propias.

Los planes Gmail se verifican con store cifrado y disco temporal reales,
fallos antes/después de efectos y checkpoints, conteos parciales, replay,
concurrencia, cambios de cuenta, cuota y corrupción. Las suites de IPC y wrapper
comprueban payload, actor/frame, cancelación del diálogo, señales, contrato y
proyección. `gmail-plan-sdk.test.ts` usa googleapis/OAuth2 reales con fetch
simulado y token ficticio: comprueba ausencia de retry tras 503 y cancelación
durante un interceptor anterior al transporte, tanto en planes como en envío.
No se conecta a Google ni envía correo. El smoke DPAPI de tres procesos verifica
además restauración y aislamiento del store Gmail; no acredita interacción humana
con los diálogos ni funcionamiento completo con una cuenta remota real.

`calendar-ipc.test.ts` cubre actor/frame, schemas, confirmación, concurrencia,
vencimiento, cambios A-B-A, navegación y proyección sin secretos. Las pruebas
renderer verifican el sobre de eventos, el contrato de creación del chat y
la cancelación; servicio/preload tienen regresiones de la guarda y allowlist.
Son dobles locales, no interacción humana ni una llamada real a Google.
`test:quality` prueba comparación de baseline y ESLint real: un error de parser
no puede clasificarse como deuda aceptada. Se ejecuta dentro de verify:pr.

El pool de Vitest está acotado a cuatro workers o los núcleos disponibles si son
menos. Se conservan timeout/hook de 15 segundos. Las dos suites XLSX cargan
ExcelJS durante recolección para que los casos midan creación/lectura real y
no incluyan la importación fría de terceros bajo saturación. La prueba de
carga fría de la aplicación sigue siendo una verificación de rendimiento
separada. Opción del pool: [documentación oficial](https://vitest.dev/config/maxworkers.html).

`integrated-browser-resource-policy.test.ts` verifica presupuesto LRU, exceso
protegido, recuperación, gracia/warm, throttling, reprogramación, stop, perfiles,
errores y publicación de retiradas parciales. Las regresiones del servicio
reproducen la presión sobre audio, captura, carga y DevTools. El smoke nativo
`browser:smoke:native -- --electron RUTA_ABSOLUTA --lifecycle-only` añade vistas
reales locales, snapshot, retirada y rematerialización al cierre/checkpoint.
Simula la actividad protegida; no prueba multimedia real, memoria ni instalador.

`SelectDropdown.test.tsx` cubre identidad dinámica, opciones vacías/deshabilitadas,
prefijos, atajos/composición, foco, Escape, relaciones ARIA y geometría. Las
suites de StudioProduction/StudioProgram mantienen regresiones de consumidores.
`npm run select:smoke:native -- --electron RUTA_ABSOLUTA` compila el componente
real y sus estilos en sandbox sin .env ni bootstrap. Usa Chromium/Electron
oculto con foco emulado por CDP, páginas locales y red bloqueada; comprueba árbol
AX, portal modal, teclado, desplazamiento y 200% con movimiento reducido. No
acredita lector de pantalla, contraste global, instalador ni certificación.

Project Hub: `project-hub-session-regressions.test.ts` reproduce restore anónimo,
identidad SOFIA no verificada, A/B/A, respuestas tardías, canjes fuera de orden,
single-flight, acceso vencido y mutaciones sin replay. `project-hub-session-store.test.ts`
usa disco temporal y AES-GCM real de prueba para cuotas, corrupción, propietario,
junction, orden save/clear y recifrado; no simula seguridad del SO.
`project-hub-transport.test.ts` cubre límites, timeout, reintento/cancelación y
envelopes. `project-hub-http.test.ts` añade servidor HTTP real en loopback con
datos ficticios, redirects, streaming excesivo, aborto y la fachada completa.

`npm run calendar:smoke:native` conserva calendario/Gmail y añade Project Hub:
tres procesos Electron con DPAPI, perfil temporal, restauración, rotación,
rechazo de archivo copiado a otro dueño y cierre local; legado ficticio
conservado. Sólo importa los stores, sin bootstrap ni SDK de cuentas reales.
No acredita backend, RLS, revocación JWT ni guardas IPC de Project Hub.

`project-hub-ipc.test.ts` añade caller/frame/origen/ventana, aridad, schemas,
destino comprobado, snapshot y confirmación de diez mutaciones de dominio, incluyendo
expiración/A-B-A y resultados inciertos. `project-hub-contract.test.ts` cubre
schemas y cuotas JSON; `project-hub-bridge.test.ts` usa preload, allowlist,
handler y wrapper reales con un servicio doble. `project-hub-caller-context.test.ts`
comprueba autorización hasta los diecisiete métodos de dominio con payload y retiro de espera
cancelada. `project-hub-ipc-http.test.ts` añade HTTP loopback real: aborto de
POST, navegación durante restore y renovación compartida con otro consumidor.
Diálogos y Electron se simulan en estas suites; no acreditan interacción humana
nativa ni autorización/RLS desplegados. La subida tiene sus pruebas propias.

`npm run project-hub:smoke:native` añade diez comprobaciones con Electron real,
ventanas ocultas, sandbox/contextIsolation, preload/IPC/frame y navegación
reales en perfil temporal. Bloquea red y no carga bootstrap ni SDK de cuentas;
servicio y respuesta del diálogo se simulan. Verifica caller registrado,
ventana/documento ajenos, payload, cancelación, retirada de contexto y subida
nativa y copia local con selectores/servicio simulados, sin rutas ni tokens renderer.
No constituye prueba humana del diálogo ni del servicio remoto.

`project-hub-upload-files.test.ts` inspecciona archivos temporales reales,
hash/firmas/cuotas, modificación y handles. `project-hub-upload.test.ts`
comprueba origen/path/token, orden de intención/PUT/complete y progreso parcial
sin retry. `project-hub-upload-http.test.ts` añade HTTP loopback y servicio
reales: bytes, redirects, aborto, A/B/A y timeout. `project-hub-upload-ipc.test.ts`
verifica caller, selección y confirmación compartida, cancelación/exclusión y
cuatro capas. `project-hub-upload-surface.test.ts` comprueba retirada de las
primitivas públicas. El hook renderer se verifica en
`src/__tests__/services/project-hub-upload.test.ts`: cancela al desmontarse o
cambiar proyecto, descarta resultados tardíos y conserva confirmados.
Sin cuentas reales, bucket desplegado ni validación antivirus/OOXML completa.

`project-hub-download.test.ts` prueba metadata/URL adversas, bytes/hash/formato,
disco real, directorio sustituido, colisiones antes/durante publicación y saved
verdadero tras cancelar después del commit. La inyección de fallo de confirmación
de link conserva incertidumbre y la UI no afirma ausencia de copia con cancelación.
`project-hub-download-http.test.ts` usa servicio/HTTP/disco reales ficticios para redirects, exceso/hash, aborto del
cuerpo con conexión cerrada y A/B/A; timeout usa reloj/fetch simulados.
`project-hub-download-ipc.test.ts` comprueba caller, payload, revisión/selector,
slot compartido con upload, cancelación por tipo/id/frame y cuatro capas sin URL.
`src/__tests__/services/project-hub-download.test.ts` verifica wrapper/hook y
respuestas tardías; `src/__tests__/components/UnifiedProjectHub.test.tsx` prueba
Guardar copia sólo para ready, cancelación y retirada de la lista antigua al
cambiar proyecto. La prueba nativa simula servicio/diálogo: no certifica
interacción humana, filesystem de producción ni autorización remota.

Voz: `local-voice-authorization.test.ts` comprueba los nueve handlers, caller,
A/B/A, revisión cancelada/tardía, copia revisada, incertidumbre de instalación,
restauración y destinatarios. `voice-capture-boundary.test.ts` ejercita el
comando/notificación directo y arranque sin captura; `python-sidecar-lifecycle`
incluye detener dictado antes de ready. `voice-synthesis-queue.test.ts` conserva
prefetch con cancelación/cuota y `orb-tts.test.ts` acota streams reales ficticios
y cancela cuerpos pendientes. `meeting-transcription-port.test.ts` verifica
interrupción y la carrera antes de registrar consumidor; `VoiceAuthorization`
cubre UI de reactivación/detención y sondeo sin solapamiento.
`voice:smoke:native` atraviesa preload/allowlist e IPC reales con ventanas ocultas,
red bloqueada y perfil temporal; servicio/diálogos son simulados, sin micrófono,
modelos ni credenciales. No certifica aprobación humana ni audio de producción.

Documentos Python: `python-tools-ipc` cubre caller, argumentos, selector, A/B/A,
cambio de política y preload/allowlist. `python-document-snapshot` usa disco
temporal y valida cuotas, firma, cancelación y limpieza. `python-privacy-store`
inyecta fallos de escritura/rename, colisión y desaparición durante carga.
`python-tools-contract` cubre presupuestos, Unicode, campos mínimos, generación
antigua y limpieza diferida al cierre. `python-protected-readers`, la cascada de
escritorio y `PrivacySettings` comprueban fallback y estados de UI. Los tests
Python de documentos/privacidad usan el intérprete que los ejecuta, con XLSX y
DOCX ficticios. `python-tools:smoke:native` atraviesa IPC real de Electron con
perfil aislado, red bloqueada y lector/diálogos simulados. Alcance y límites:
[frontera documental](../security/python-document-boundary.md).

El runner `python/tools_sidecar/tests/run_tests.py` ejecuta unittest stdlib de
recursos; `--formats` añade pruebas con dependencias reales del lector, sin
pytest ni descargas. Cubre expansión ZIP, DTD UTF-16, CRC, directorio/entradas,
cuotas XML acumuladas, dimensiones Excel falsas, spans Word, cierre en fallos,
Unicode/relleno y ampliación por redacción. PDF declara parcialidad; PPTX/Word y
Excel conservan tablas. Stdio verifica ping durante lectura, rechazo de recursos
y otro ping posterior en el mismo proceso. Estas pruebas Python son separadas
de verify:pr; las versiones QA y limitaciones se registran en el reporte.
