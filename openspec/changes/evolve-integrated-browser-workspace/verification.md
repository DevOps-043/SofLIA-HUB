# Evidencia de verificacion

Fecha: 2026-08-04. Entorno: Windows, Node 24.16.0, Electron 39.8.5.

## Resultado actualizado

- Pruebas focales del selector compacto, barra, predicciones y extensiones: 4
  archivos y 33 casos aprobados.
- Suite completa del renderer: 42 archivos y 218 casos aprobados.
- Suite completa del navegador integrado en main: 6 archivos y 28 casos
  aprobados.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: 113 archivos revisados, sin deuda nueva.
- `npm run harness:validate`: 25 rutas y 8 skills validas.
- `npm run docs:check`: 150 Markdown activos con enlaces validos.
- `npm run docs:system:check`: 28 documentos, 144 IDs, 302 canales y 309
  archivos de prueba consistentes.
- `npm run openspec:validate`: 10 cambios aprobados en modo estricto.
- Build de Vite aprobado para renderer, main y preload. Conserva solamente los
  avisos preexistentes de chunks grandes e imports mixtos.
- `git diff --check`: aprobado; Git solo informo normalizacion futura de LF a
  CRLF en archivos existentes del worktree.

## Excepcion ambiental de la compuerta integral

`npm run verify:pr` aprobo adaptadores, arnes, documentacion, OpenSpec, tipado y
lint, y se detuvo al preparar `better-sqlite3` para `npm run test`. La aplicacion
Electron abierta mantiene `better_sqlite3.node` bloqueado y Windows devuelve
`EPERM` al reemplazarlo; el sandbox tambien impide escribir en la cache global
de npm. No se cerro la aplicacion del usuario por la fuerza.

Para cerrar esa compuerta general hay que cerrar todas las instancias de SofLIA
que cargan el binario y volver a ejecutar `npm run verify:pr`. Las suites
especificas de este cambio y la compilacion completa si quedaron aprobadas.

## Revision adversarial

Se intentaron refutar los contratos nuevos y se corrigieron los siguientes
riesgos:

- una preferencia cambiada en el panel compacto podia dejar desactualizado el
  runtime del chat montado; ahora ambas superficies se sincronizan en la misma
  ventana y existe una prueba de regresion;
- una respuesta asincrona de apertura podia sobrescribir la direccion mientras
  el usuario escribia; el estado de edicion ahora protege el valor;
- las sugerencias podian duplicar URLs; se deduplican, tienen limite y navegacion
  accesible por teclado;
- los permisos opcionales y hosts opcionales de una extension podian quedar
  fuera de la confirmacion; ahora forman parte de la inspeccion visible;
- un error nativo podia filtrar el path administrado al renderer; la UI recibe
  un mensaje generico y el detalle queda exclusivamente en main;
- una extension en error no podia reintentarse si seguia marcada como habilitada;
  la accion `Reintentar` fuerza una nueva carga idempotente;
- una carpeta podia modificarse entre inspeccion y confirmacion conservando el
  mismo tamano; main verifica tamano y SHA-256 de cada archivo antes de copiar;
- archivos fuera de limites podian leerse antes del rechazo; conteo y tamano se
  validan antes de cargar el contenido.

## Riesgos residuales y QA pendiente

- La comprobacion visual en una instancia Electron real no pudo ejecutarse: la
  herramienta de control de Windows fallo con `EPERM` al acceder a los datos
  locales de Codex. Por ello la tarea historica 7.4 permanece abierta.
- Chrome Web Store y archivos CRX siguen fuera de alcance; solo se admiten
  carpetas Manifest V3 desempaquetadas e inspeccionadas.
- La compatibilidad de APIs depende del subconjunto de extensiones soportado por
  Electron; los fallos quedan visibles y ahora pueden reintentarse.

## Iteración: favoritos y predicciones contenidas

Verificación ejecutada el 2026-08-04 sobre el mismo worktree:

- pruebas focales de panel e historial: 2 archivos y 21 casos aprobados;
- suite completa del renderer: 42 archivos y 215 casos aprobados;
- suite completa del navegador integrado en main: 6 archivos y 29 casos
  aprobados;
- typecheck, lint incremental de 116 archivos, arnés, enlaces, documentación de
  sistema y 10 cambios OpenSpec: aprobados;
- build Vite de renderer, main y preload: aprobado con los avisos preexistentes
  de chunks grandes e imports mixtos;
- `verify:pr` aprobó todas sus etapas anteriores a `npm run test` y volvió a
  detenerse al reconstruir `better-sqlite3`: la aplicación abierta bloquea el
  binario y el sandbox no puede escribir en la caché global de npm.

Hipótesis adversariales intentadas y resultado:

- una consulta corta como `s` devolvía todo por `https://`: main excluye el
  protocolo del texto indexable, pero conserva búsquedas explícitas con `://`;
- excluir protocolo podía romper búsquedas escritas con `www.`: se indexan ambas
  variantes del host y existe prueba negativa/positiva;
- un dropdown renderer podía quedar debajo del `WebContentsView`: las
  predicciones se renderizan como una capa absoluta y coordinan captura,
  ocultación y restauración temporal de la vista nativa;
- `localStorage` manipulado podía inyectar favoritos inválidos o enormes: se
  aceptan solo HTTP(S), se eliminan credenciales, se sanean títulos, se deduplican
  URLs y se limita la colección a 24;
- respuestas de extensiones fuera de orden podían restaurar metadata antigua:
  un identificador monotónico descarta respuestas obsoletas;
- demasiadas extensiones podían saturar la fila: se muestran doce accesos y un
  contador abre el gestor para el resto; en anchos estrechos se ocultan labels,
  no acciones.

Riesgo residual: los favoritos son una preferencia local del renderer y no se
sincronizan entre dispositivos. Los accesos de extensión abren el gestor y
muestran estado; no simulan `browserAction` ni amplían el subconjunto de APIs de
Chrome soportado por Electron.

## Iteración: predicciones superpuestas tipo Chrome

Verificación ejecutada el 2026-08-04 sobre el mismo worktree:

- prueba focal de `IntegratedBrowserPanel`: 20 casos aprobados;
- suite completa del renderer: 42 archivos y 218 casos aprobados;
- `npm run typecheck` y lint dirigido de los tres archivos TypeScript tocados:
  aprobados;
- `docs:check`: 150 documentos activos; `docs:system:check`: 28 documentos,
  144 IDs, 302 canales y 309 archivos de prueba; ambos aprobados;
- `harness:validate`: 25 rutas y 8 skills canónicas; aprobado;
- validación estricta del cambio OpenSpec: aprobada;
- build Vite de renderer, main y preload: aprobado fuera del sandbox después de
  que esbuild no pudiera leer `vite.config.ts` en OneDrive dentro del sandbox;
  conserva solo avisos preexistentes de chunks grandes e imports mixtos.

Hipótesis adversariales intentadas y resultado:

- el menú podía seguir empujando pestañas y favoritos: ahora es absoluto y el
  header mantiene su geometría;
- la capa nativa podía cubrir el dropdown: al primer conjunto visible se captura
  una sola vez y se oculta temporalmente el `WebContentsView`;
- cada tecla podía repetir captura/ocultación: los resultados anteriores se
  conservan durante el debounce y la transición solo ocurre al pasar entre
  lista vacía y lista visible;
- una captura tardía tras Escape podía volver a ocultar la página: un ID de
  generación invalida la operación y existe una prueba que confirma que `hide`
  no se ejecuta;
- abrir un gestor durante una restauración podía capturar una vista todavía
  oculta: el gestor espera la restauración pendiente antes de tomar su captura;
- seleccionar, pulsar Escape, perder foco o quedar sin resultados descarta la
  captura y republica los mismos bounds, sin recargar ni crear otra sesión.

Riesgo residual: falta confirmar visualmente en una instancia Electron real el
aspecto exacto sobre sitios claros/oscuros y con dos pestañas visibles; la tarea
histórica 7.4 continúa abierta por esa razón. Las pruebas automatizadas cubren
la geometría de flujo, el ciclo captura/ocultación/restauración y la carrera de
respuesta tardía.

## Iteración: percepción visual y DOM continua

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- pruebas dirigidas de percepción, servicio, IPC, preload, Computer Use, chat y
  panel: 9 archivos y 82 casos aprobados;
- suite completa del renderer: 42 archivos y 219 casos aprobados;
- `npm run typecheck` y lint incremental de 122 archivos: aprobados;
- `docs:check`: 150 documentos activos; `docs:system:check`: 28 documentos,
  144 IDs, 304 canales y 310 archivos de prueba; aprobados;
- `harness:validate` y validación estricta OpenSpec: aprobados;
- build Vite de renderer, main y preload: aprobado, con los avisos preexistentes
  de chunks grandes e imports mixtos.

La suite agregada `npm run test` no pudo iniciar porque la instancia de SofLIA
abierta mantiene bloqueado `better_sqlite3.node` durante el rebuild para Node.
No se cerró la aplicación ni se modificó el binario en uso; la evidencia
dirigida y la suite completa del renderer se ejecutaron directamente con
Vitest.

Hipótesis adversariales intentadas y resultado:

- una página enorme podía congelar la vista al recorrer todo el DOM: el
  observador limita texto, colecciones, profundidad y 6.000 nodos de texto y
  elementos, y nunca solapa dos capturas;
- cambiar de pestaña durante una captura podía devolver la imagen anterior: la
  operación queda ligada a pestaña y URL, espera la captura en curso y vuelve a
  observar el destino enfocado;
- un fallo de DOM podía reutilizar evidencia de otra pestaña: solo se acepta un
  cache compatible con la misma pestaña y URL saneada;
- valores de inputs, textarea, select, contenteditable, contraseñas o tokens de
  URL podían salir por IPC: el script no lee valores y main normaliza y elimina
  credenciales, query y fragment antes de exponer metadata;
- una página podía inyectar instrucciones en el system prompt: el DOM viaja en
  el contenido no confiable del turno y el system prompt ordena tratarlo solo
  como evidencia, sin conceder autorización;
- pausar u ocultar podía dejar capturas retenidas: ambos flujos descartan el
  snapshot; una captura que termine tarde no se conserva.

Riesgo residual: la imagen puede contener datos sensibles que sean visibles en
la propia página y cada sitio puede estructurar su accesibilidad de forma
distinta. La percepción solo opera en la pestaña enfocada del navegador
integrado, se suspende con la ventana minimizada, no observa el escritorio y el
usuario dispone de un control visible para pausarla.

## Iteración: refinamiento visual, autenticación y pestañas virtualizadas

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- pruebas dirigidas de servicio, OAuth/2FA, LRU, compositor, selector,
  workspace y panel: 6 archivos y 44 casos aprobados;
- prueba de límite con 500 pestañas lógicas: ocho vistas vivas, activa
  protegida, restauración de pestaña suspendida y rechazo de la 501;
- `npm run typecheck`: aprobado;
- `lint:changed`: 126 archivos revisados sin deuda nueva;
- `docs:check`: 150 documentos activos; `docs:system:check`: 28 documentos,
  144 IDs, 304 canales y 310 archivos de prueba; aprobados;
- `harness:validate` y validación estricta OpenSpec: aprobados;
- build Vite de renderer, main y preload: aprobado; conserva avisos
  preexistentes de chunks grandes e imports mixtos.

`npm run verify:pr` completó todas sus etapas anteriores a la suite agregada.
La suite agregada no pudo iniciar porque la instancia de SofLIA abierta mantiene
bloqueado `better_sqlite3.node` y Windows devolvió `EPERM` durante el rebuild
para Node/Vitest. No se cerró la aplicación ni se mutó el binario en uso.

Hipótesis adversariales intentadas y resultado:

- 500 `WebContentsView` simultáneas podían agotar memoria y CPU: el límite se
  aplica a pestañas lógicas y solo ocho vistas permanecen vivas; las inactivas
  se suspenden por LRU y usan `backgroundThrottling`;
- la suspensión podía cerrar la activa o una vista dividida: activa, primaria y
  secundaria son IDs protegidos antes de elegir candidatos;
- una vista retirada podía emitir eventos tardíos y corromper la restaurada:
  cada listener comprueba que sigue perteneciendo a la generación actual y una
  prueba negativa cubre el caso;
- relajar redirecciones para Google podía aceptar protocolos peligrosos: solo
  se ignoran subframes; el frame principal conserva la allowlist y la prueba
  bloquea `javascript:`;
- el aviso de redirección podía persistir tras una carga válida: una carga
  principal HTTP(S) completada limpia el error de la pestaña;
- el selector de razonamiento podía perder semántica al dejar los botones
  segmentados: conserva `radiogroup`, filas `radio`, nombre, descripción,
  estado y foco visible;
- el modal de ajustes podía perder foco o cerrarse al pulsar dentro: contiene
  Tab, cierra con Escape, restaura foco y detiene el evento del contenido.

Riesgo residual: restaurar una pestaña suspendida recarga su última URL y no
conserva la pila atrás/adelante. El smoke visual automatizado no pudo iniciarse
porque el runtime de Computer Use no obtuvo permiso para leer su instalación
local (`EPERM`); la tarea histórica 7.4 sigue abierta y requiere reiniciar la
app para cargar el main nuevo y comprobar el aspecto exacto sobre sitios reales.

## Iteración: referencias contextuales de la página activa

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- pruebas dirigidas de clasificación, ruteo Gemini/OpenAI y prompt: 3 archivos
  y 19 casos aprobados;
- `npm run typecheck`: aprobado;
- `lint:changed`: 128 archivos revisados sin deuda nueva;
- `harness:validate`, `docs:check`, `docs:system:check` y validación OpenSpec
  estricta: aprobados; el inventario contiene 311 archivos de prueba;
- build Vite de renderer, main y preload: aprobado, con los avisos preexistentes
  de chunks grandes e imports estáticos/dinámicos mixtos.

`npm run verify:pr` aprobó adaptadores, arnés, documentación, OpenSpec,
typecheck y lint. La suite agregada volvió a detenerse antes de Vitest: la
instancia abierta de SofLIA mantiene bloqueado `better_sqlite3.node` y el
sandbox no puede escribir en la caché global de npm. No se cerró la aplicación
ni se alteró el binario nativo en uso.

Hipótesis adversariales intentadas y resultado:

- mencionar un repositorio en una consulta general podía anclarla por error a
  la pestaña: la clasificación exige una referencia visual, deíctica, relacional
  o a una conversación abierta y una prueba negativa conserva `none`;
- una captura ausente podía repetir el falso “no tengo acceso”: el turno
  contextual habilita `use_computer` con backend browser antes de responder;
- SofLIA Pro podía perder imagen o DOM al usar OpenAI: el test de proveedor
  comprueba ambos en el input y conserva lectura directa cuando el texto ya es
  visible;
- seguir un enlace podía ampliar permisos: la observación y el prompt etiquetan
  página/DOM como datos no confiables y la lectura no autoriza escrituras,
  envíos, instalaciones o aceptación de permisos;
- una captura puntual podía congelar el compositor: el renderer limita la
  espera a ocho segundos y el proceso main conserva captura serializada;
- una pestaña oculta podía capturarse por accidente: se consulta primero el
  estado visible y no se invoca observación si la vista está cerrada.

Riesgo residual: sitios basados en canvas o iframes inaccesibles pueden exigir
reconocimiento visual y el enlace visible puede ser ambiguo. Computer Use debe
verificar el destino antes de resumir; ninguna evidencia visual sustituye HITL
para mutaciones.

## Iteración: orquestación estable y navegación compacta entre chats

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- pruebas dirigidas de ruteo, proveedor y workspace: 3 archivos y 31 casos
  aprobados;
- `npm run typecheck`: aprobado;
- `lint:changed`: 129 archivos revisados sin deuda nueva;
- `git diff --check`: aprobado; solo informó las conversiones LF/CRLF ya
  configuradas en el worktree;
- `harness:validate`, `docs:check`, `docs:system:check` y validación OpenSpec
  estricta: aprobados antes del cierre documental;
- build Vite de renderer, main y preload: aprobado, con los avisos preexistentes
  de chunks grandes e imports estáticos/dinámicos mixtos.

`npm run verify:pr` aprobó adaptadores, arnés, documentación, OpenSpec,
typecheck y lint. La suite agregada no pudo preparar Vitest porque la instancia
abierta de SofLIA mantiene bloqueado `better_sqlite3.node` y Windows devolvió
`EPERM`; la caché global de npm tampoco es escribible desde el sandbox. No se
cerró la aplicación ni se alteró el binario nativo en uso.

Hipótesis adversariales intentadas y resultado:

- una referencia a la página podía reemplazar SofLIA Pro/Max por Gemini para
  todo el turno: el modelo seleccionado permanece como orquestador y las
  pruebas comprueban el proveedor efectivo;
- los niveles de razonamiento podían resultar irrelevantes tras el cambio de
  proveedor: el nivel elegido se conserva y se traduce en el cliente del
  orquestador seleccionado;
- corregir el orquestador podía cambiar el modelo actuador: `use_computer`
  continúa delegando únicamente la ejecución al Gemini 3.6 Flash fijo de main;
- pulsaciones repetidas podían crear chats duplicados: las acciones se
  deshabilitan mientras existe una operación pendiente;
- un fallo al crear o seleccionar chat podía cerrar el menú y ocultar el
  problema: el popover permanece abierto, muestra un error contextual y una
  prueba negativa cubre el rechazo;
- el popover podía recortarse en el ancho mínimo del sidecar: el disparador
  ocupa el extremo derecho y el menú se alinea hacia dentro;
- los selectores de modelo y conversación podían solaparse: abrir uno cierra
  explícitamente el otro;
- cerrar con Escape podía perder el foco: el foco vuelve al botón disparador y
  la interacción está cubierta por prueba.

Riesgo residual: la prueba visual histórica 7.4 sigue pendiente. La instancia
abierta debe reiniciarse para cargar renderer y main nuevos y validar el flujo
real con cuota de proveedor, sesión autenticada y un sitio de producción.

## Iteración: DOM y búsqueda web independientes de Computer Use

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- pruebas dirigidas de herramientas DOM, ruteo Gemini/OpenAI, grounding y
  herramientas hospedadas: 5 archivos y 47 casos aprobados;
- `npm run typecheck`: aprobado;
- `lint:changed`: 138 archivos revisados sin deuda nueva;
- `harness:validate`, `docs:check`, `docs:system:check`, validación OpenSpec
  estricta y `git diff --check`: aprobados;
- build Vite de renderer, main y preload: aprobado fuera del sandbox, con los
  avisos preexistentes de chunks grandes e imports mixtos.

`npm run verify:pr` aprobó adaptadores, arnés, documentación, OpenSpec,
typecheck y lint. La suite agregada se detuvo antes de Vitest porque la
instancia abierta de SofLIA mantiene bloqueado `better_sqlite3.node`; el
reintento fuera del sandbox confirmó `EBUSY/EPERM`. No se cerró la aplicación
ni se reemplazó el binario nativo en uso.

Hipótesis adversariales intentadas y resultado:

- una consulta informativa podía activar Computer Use por contener “busca”:
  las búsquedas puras usan la herramienta hospedada del proveedor sin loop
  visual;
- seguir un recurso podía sustituir el modelo seleccionado: OpenAI conserva
  Pro/Max como orquestador y Gemini intenta primero el modelo elegido; sólo
  `use_computer` delega actuación al Gemini 3.6 Flash fijo de main;
- un fallo del grounding podía terminar en una respuesta sin leer la página:
  escala a `read_browser_dom` y navegación determinista antes de Computer Use;
- el DOM podía filtrar la captura base64 o ejecutar instrucciones de la página:
  la salida se acota, omite screenshot y se marca como contenido no confiable;
- una observación pausada podía reactivarse por una herramienta: el servicio
  devuelve `null`, la herramienta falla cerrada y no escala automáticamente;
- una navegación pedida por el modelo podía cambiar una pestaña oculta: ahora
  exige que el navegador y la pestaña objetivo estén visibles antes del IPC;
- una solicitud mixta de OpenAI podía perder búsqueda al habilitar funciones:
  `web_search` y funciones locales permanecen disponibles con selección
  automática del orquestador.

Riesgo residual: páginas canvas, iframes inaccesibles, contenido autenticado o
interfaces altamente dinámicas pueden requerir Computer Use. Ese fallback sigue
sin ampliar permisos: cualquier mutación crítica conserva su HITL y el DOM
remoto nunca concede autorización.

## Iteración: geometría estable de predicciones

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- Vitest directo del panel y layout del navegador: 2 archivos y 32 casos aprobados;
- `npm run typecheck`: aprobado;
- ESLint dirigido de componente y prueba: aprobado sin advertencias;
- `npm run harness:validate`, validación OpenSpec estricta y `git diff --check`: aprobados.

El wrapper `npm test` no alcanzó Vitest porque la instancia abierta de SofLIA
mantiene bloqueado `better_sqlite3.node` y Windows devolvió `EBUSY/EPERM`. La
suite renderer, que no depende de SQLite, se ejecutó directamente sin cerrar la
aplicación ni reemplazar el binario nativo en uso.

Hipótesis adversariales intentadas y resultado:

- elevar el menú podía elevar también la página sobre el chat: solo el header
  usa la capa superior; el viewport y su captura conservan `z-0`;
- la captura podía estirarse al ancho total y cambiar la escala: su contenedor
  reutiliza ambos insets publicados al `WebContentsView` y elimina
  `object-cover`;
- mover el chat a la derecha podía reintroducir el defecto: la prueba combina
  insets izquierdo y derecho y verifica el ancho exacto resultante;
- el snapshot podía interceptar clics: su superficie es `pointer-events-none`;
- cerrar sugerencias podía dejar la vista oculta: las pruebas existentes de
  selección, Escape y captura tardía continúan aprobadas.

Riesgo residual: la prueba visual histórica 7.4 continúa pendiente y exige
reiniciar la instancia abierta para cargar el renderer actualizado. No afecta
la verificación automatizada de geometría ni reabre esa tarea histórica.

## Iteración: rendimiento de páginas dinámicas

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- Vitest directo de servicio, percepción DOM, handlers, wrapper y panel: 5
  archivos y 40 casos aprobados;
- `npm run typecheck`: aprobado;
- `lint:changed`: 139 archivos revisados sin deuda nueva;
- `docs:check`, `docs:system:check`, `harness:validate`, OpenSpec estricto y
  `git diff --check`: aprobados.

`npm run verify:pr` aprobó adaptadores, arnés, documentación, las diez
especificaciones activas, typecheck y lint. La suite global se detuvo antes de
Vitest porque la instancia abierta de SofLIA mantiene bloqueado
`better_sqlite3.node` y Windows devolvió `EBUSY/EPERM`. No se cerró la app ni se
reemplazó el binario nativo en uso.

Hipótesis adversariales intentadas y resultado:

- la percepción pasiva podía seguir bloqueando YouTube con un walker DOM: ahora
  solo captura imagen cada cinco segundos y no ejecuta JavaScript;
- el turno del agente podía duplicar la captura: reutiliza la evidencia visual
  reciente de la misma pestaña y URL;
- temporizador y turno podían capturar simultáneamente: la ruta pasiva cede ante
  una observación completa en vuelo;
- una captura podía cruzarse entre pestañas o navegaciones: identidad de pestaña,
  URL y estado visible se revalidan antes de conservarla;
- el walker podía filtrar formularios o secretos: las pruebas negativas de
  valores, password y URL saneada siguen aprobadas;
- desactivar throttling podía acelerar una vista degradando toda la ventana: se
  conservó `backgroundThrottling: true` porque Electron aplica `false` a todos
  los `WebContents` del host;
- un User-Agent fijo podía quedar obsoleto o mentir sobre versión: se deriva del
  runtime y elimina únicamente el token `Electron/<versión>`.

Riesgo residual: el tiempo real del endpoint de transcripciones depende también
de YouTube, red, cookies y experimentos de cuenta. Se requiere reiniciar SofLIA
para cargar main actualizado y repetir el caso real; la prueba histórica 7.4
continúa pendiente.

## Iteración: ventanas separadas y presupuesto global

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- Vitest dirigido de servicio, handlers, preload, wrapper y panel: 6 archivos y
  71 casos aprobados;
- `npm run typecheck` y `npm run lint:changed`: aprobados sin deuda nueva;
- `npm run verify:pr`: aprobado de extremo a extremo, incluidos 138 archivos y
  1181 casos de Vitest;
- `docs:check`, `docs:system:check`, `harness:validate`, OpenSpec estricto y
  `git diff --check`: aprobados.

Hipótesis adversariales intentadas y resultado:

- separar una pestaña podía recargarla, perder cookies o duplicar el renderer:
  se mueve el mismo `WebContentsView` a un `BaseWindow` sin llamar `loadURL`;
- una ventana separada podía escapar al límite LRU: sus pestañas permanecen
  protegidas, con máximo de cuatro ventanas y ocho vistas vivas globales;
- el agente podía observar o actuar sobre una pestaña distinta: el foco de la
  ventana actualiza `activeTabId` y captura, DOM y Computer Use resuelven el
  mismo host;
- cerrar la ventana nativa podía destruir el estado: el cierre reintegra la
  vista al workspace principal; cerrar la pestaña sí destruye ambos recursos;
- cerrar la pestaña principal con ventanas separadas podía elegir como reemplazo
  una vista fuera del workspace: el fallback ahora prioriza una pestaña integrada;
- la percepción pasiva podía consumir recursos en ventanas sin foco: se omite
  mientras el host no está enfocado, pero una observación explícita del agente
  conserva captura y DOM bajo demanda;
- un renderer no autorizado podía invocar los canales nuevos: ambos handlers
  conservan autenticación, validación de sender y validación estricta de `tabId`.

Riesgo residual: cada ventana separada añade una superficie nativa y su compositor,
aunque no crea otro renderer de la página ni otro perfil. Por eso el límite se
mantiene en cuatro ventanas separadas dentro del presupuesto global de ocho vistas
vivas y hasta 500 pestañas lógicas suspendibles. La prueba visual histórica 7.4
continúa pendiente y no forma parte de esta iteración.

## Iteración: percepción adaptativa y fluidez de páginas dinámicas

Verificación ejecutada el 2026-08-05 sobre el mismo worktree y rama:

- Vitest dirigido de servicio, percepción DOM, driver de Computer Use, wrapper y
  panel: 5 archivos y 45 casos aprobados;
- `npm run typecheck` y `npm run lint:changed`: aprobados; el lint incremental
  revisó 141 archivos sin deuda nueva;
- `npm run build:app`: aprobado para renderer, main y preload;
- `npm run verify:pr`: aprobado de extremo a extremo, incluidos 138 archivos y
  1182 casos de Vitest;
- `docs:check`, `docs:system:check`, `harness:validate`, OpenSpec estricto y
  `git diff --check`: aprobados.

Hipótesis adversariales intentadas y resultado:

- una captura PNG completa podía competir con el compositor mientras YouTube
  cargaba la transcripción: la copia pasiva se reduce a 1024 px y se ejecuta con
  cadencia base de diez segundos;
- clics, escritura, scroll, navegación o resize podían coincidir con una captura:
  cada actividad invalida la revisión anterior y abre una ventana de calma de
  cuatro segundos;
- una captura antigua podía completar después de la actividad y reemplazar la
  programación nueva: el temporizador usa una generación monotónica y descarta
  completados obsoletos;
- la percepción pasiva podía competir con Computer Use: se omite mientras el
  agente controla la pestaña y se reprograma después de liberar el control;
- degradar la evidencia pasiva podía afectar coordenadas o capturas solicitadas
  por el usuario: la reducción solo se aplica a la copia de percepción; captura
  explícita y Computer Use conservan el viewport y resolución originales;
- movimientos continuos del puntero podían impedir indefinidamente la percepción:
  `mouseMove` y eventos equivalentes no reinician la ventana de calma.

Riesgo residual: el tiempo final del endpoint de transcripciones también depende
de YouTube, red, cookies y experimentos de cuenta. La instancia de SofLIA debe
reiniciarse para cargar el proceso main actualizado y repetir el caso visual real;
la prueba histórica 7.4 continúa pendiente y no forma parte de esta iteración.

## Iteración: Google Meet iniciado desde Gmail o Google Chat

Verificación ejecutada el 2026-08-11 sobre el worktree compartido:

- Vitest dirigido de permisos, ventana hija, servicio, handlers, preload,
  wrapper y aviso renderer: 6 archivos y 80 casos aprobados;
- `npm run typecheck`: aprobado;
- `npm run lint:changed`: 110 archivos revisados sin deuda nueva;
- `npm run harness:validate`: 25 rutas y 8 skills canónicas aprobadas;
- `npm run docs:check`: 179 documentos activos con enlaces válidos;
- `npm run openspec:validate`: 15 cambios aprobados en modo estricto;
- `npm run build:app`: renderer, main y preload aprobados; conserva los avisos
  no bloqueantes ya existentes de chunks grandes e imports mixtos;
- el bundle de main contiene el field trial
  `WebRTC-SdpBundlePayloadTypeCollisionCheck/Disabled/` antes del bootstrap.

`npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, pero se
detuvo en `docs:system:check` por tres inconsistencias ajenas a este arreglo que
ya existen en el worktree compartido: una referencia a una migración SDO
eliminada, el total global de canales IPC desactualizado y el inventario global
de pruebas desactualizado. No se modificaron esos dominios para maquillar la
compuerta. Un intento separado de la suite global `npm run test` excedió 124 s
sin producir resultado; sus workers iniciados por ese comando se cerraron. La
suite focal sí concluyó y queda registrada arriba.

Hipótesis adversariales intentadas y resultado:

- permitir `media` sin origen podía conceder un dispositivo desde
  `about:blank`: solo responde afirmativamente a la consulta síncrona de
  contenido ya adoptado; la prueba negativa confirma que la solicitud real sin
  origen responde `false`;
- una decisión denegada podía ignorarse por la ruta de respaldo: con origen
  explícito o URL comprometida se consulta el store y la negativa permanece;
- una ventana hija podía quedar fuera de la gobernanza: la primera mitigación
  la registró en `did-create-window`; el smoke real posterior demostró que la
  consulta inicial podía adelantarse a ese evento, por lo que esta hipótesis se
  reabrió en la iteración siguiente;
- un popup podía usar la concesión provisional para navegar a protocolos
  externos: la ventana conserva el bloqueo de navegación fuera de HTTP(S);
- desactivar la validación BUNDLE podía ampliar permisos: el field trial solo
  cambia la aceptación del SDP; origen, HITL, store y permiso del sistema siguen
  en una frontera separada y cubierta por pruebas.

Riesgo residual: el field trial afecta a todas las conexiones WebRTC del
proceso y tolera SDP con payloads BUNDLE inconsistentes, aunque conserva el log
y no concede captura. El rollback es retirar el switch de `electron/main.ts`.
La prueba real requiere reiniciar la instancia Electron para cargar el nuevo
main y entrar manualmente a una llamada con una cuenta Google autorizada; no se
forzó el cierre de la aplicación ni se inició una reunión externa durante esta
verificación.

## Seguimiento: carrera previa a `did-create-window` en Google Meet

Verificación ejecutada el 2026-08-11 después de que el smoke real mostrara
`Consulta denegada (contenido ajeno al navegador): media` inmediatamente antes
de registrar la ventana hija:

- la creación de ventanas `about:blank` permitidas se controla ahora desde
  `setWindowOpenHandler`; main registra y normaliza la ventana antes de devolver
  su `webContents` a Chromium;
- Vitest focal de `IntegratedBrowserService`: 38 casos aprobados;
- suite dirigida de permisos, ventana hija, servicio, handlers, preload,
  wrapper y aviso renderer: 6 archivos y 86 casos aprobados;
- `npm run typecheck`: aprobado por separado y nuevamente dentro del build;
- `npm run lint:changed`: 110 archivos revisados sin deuda nueva;
- `npm run harness:validate`: 25 rutas y 8 skills canónicas aprobadas;
- `npm run docs:check`: 179 documentos activos con enlaces válidos;
- `npm run openspec:validate`: 15 cambios aprobados en modo estricto;
- `npm run build:app`: renderer, main y preload aprobados; solo conserva avisos
  no bloqueantes ya existentes sobre chunks grandes e imports mixtos;
- `git diff --check` sobre los archivos de esta iteración: aprobado, con avisos
  informativos de normalización LF/CRLF.

`npm run verify:pr` volvió a aprobar adaptadores, arnés y cadena de suministro,
pero se detuvo en `docs:system:check` por las mismas tres inconsistencias del
worktree compartido: referencia a `database/lia/migrations/sdo-tables.sql`
eliminada, catálogo global distinto de los 341 canales IPC derivados e
inventario global distinto de los 359 archivos de prueba derivados. No se
alteraron esos dominios ajenos al arreglo.

Hipótesis adversariales intentadas y resultado:

- confiar en toda la partición podía autorizar superficies no registradas: se
  descartó esa alternativa; la allowlist continúa comparando instancias
  concretas de `webContents` y una ventana externa recibe `false` en consulta y
  solicitud sin mostrar aviso;
- la solicitud real podía aprovechar el `true` provisional de `about:blank`:
  la prueba confirma que sin `securityOrigin` HTTP(S) responde `false`; solo la
  consulta síncrona puede avanzar;
- crear la ventana manualmente podía perder sesión o `window.opener`: el creador
  usa las opciones completas que Electron entrega y solo superpone dimensiones
  acotadas/presentación antes de devolver el mismo `webContents`;
- omitir `did-create-window` podía saltarse User-Agent, bloqueo de protocolos o
  cleanup: la preparación síncrona normaliza el User-Agent y reutiliza la misma
  adopción que instala navegación permitida, cierre y seguimiento de ventana;
- la clave de Google Cloud TTS podía intervenir en el fallo: no participa en la
  creación del popup, WebRTC ni la gobernanza de permisos y no fue leída ni
  modificada.

Riesgo residual: falta repetir el smoke con una instancia Electron reiniciada y
una cuenta Google autorizada. El resultado esperado en terminal ya no contiene
`contenido ajeno al navegador` para `media`; debe aparecer la solicitud de
`https://meet.google.com` y, si no existe decisión guardada, el aviso renderer.

## Seguimiento: iframe cruzado y service worker de Google Meet

Verificación ejecutada el 2026-08-11 después de que el smoke real confirmara
que la solicitud de micrófono ya se concedía y que desapareció
`DisconnectedError` con `StartupCode 219`, pero todavía mostrara una consulta
`media` sin `webContents`, negativas de `background-sync` y el diagnóstico SDP:

- la consulta de un iframe cruzado ya no depende de una instancia que Electron
  entrega como `null`: exige `isMainFrame = false`, un `embeddingOrigin` HTTP(S)
  válido y resuelve el estado con el origen solicitante;
- `background-sync` recupera el comportamiento automático de Chromium dentro
  de esa frontera; no abre dispositivos ni APIs privilegiadas de Electron y su
  tráfico permanece sujeto al origen y a la sesión aislada;
- la solicitud real de cámara o micrófono no usa la excepción: conserva
  `webContents` registrado, origen HTTP(S), decisión persistida, aviso HITL y
  permiso del sistema operativo;
- Vitest focal de `IntegratedBrowserService`: 38 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 65 casos aprobados;
- suite suplementaria que incluye el panel integrado: 5 archivos y 73 casos
  aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run harness:validate`,
  `npm run docs:check`, `npm run openspec:validate` y `npm run build:app`:
  aprobados; el build conserva únicamente avisos no bloqueantes ya existentes
  de chunks grandes e imports mixtos.

`npm run verify:pr` volvió a aprobar adaptadores, arnés y cadena de suministro,
pero se detuvo en `docs:system:check` por las mismas tres inconsistencias ajenas
al arreglo: referencia a `database/lia/migrations/sdo-tables.sql` eliminada,
catálogo global distinto de los 341 canales IPC derivados e inventario global
distinto de los 359 archivos de prueba derivados.

Hipótesis adversariales intentadas y resultado:

- aceptar todo `webContents = null` podía convertir la sesión completa en una
  allowlist: se exige subframe y `embeddingOrigin` HTTP(S); ausencia de origen y
  `devtools://` están cubiertos con negativas;
- la consulta cruzada podía ignorar una decisión guardada: una negativa para el
  origen solicitante sigue devolviendo `false`;
- una consulta afirmativa podía conceder captura: la ruta de solicitud real no
  cambió y todavía rechaza contenido no registrado o sin origen antes de HITL;
- conceder `background-sync` podía describirse erróneamente como carente de
  efectos: puede generar tráfico web ordinario, por lo que documentación y
  diseño lo acotan expresamente al origen/sesión y distinguen que no abre APIs
  privilegiadas de Electron;
- el log de colisión BUNDLE podía interpretarse como evidencia de aborto:
  WebRTC lo emite antes de consultar el field trial; puede permanecer mientras
  la negociación continúa y no demuestra por sí solo el fallo de la llamada.

Riesgo residual: el arreglo requiere reiniciar por completo Electron y repetir
el smoke con la cuenta Google autorizada. Ya no deben aparecer negativas de
`media` por «contenido ajeno al navegador» ni de `background-sync` para
Gmail/Meet gobernados. El diagnóstico de payload Opus puede seguir apareciendo
y, aislado, es esperado; una nueva falla debe correlacionarse con el mensaje de
Meet y las líneas posteriores de permisos/red, no con esa línea por sí sola.

## Seguimiento: preflight anónimo de media en Electron 43

Verificación ejecutada el 2026-08-11 después de un nuevo smoke real con
Electron 43.3.0 / Chromium 150.0.7871.212. El intento volvió a mostrar
`DisconnectedError` con `StartupCode 219` y el terminal registró, antes de crear
la ventana de llamada, `Consulta denegada (contenido ajeno al navegador): (sin
origen) media`. No apareció una solicitud real de micrófono después de abrir la
ventana. Esto distingue el preflight bloqueado del diagnóstico BUNDLE, que
también apareció en el intento anterior donde la solicitud de micrófono sí fue
concedida y el error 219 había desaparecido.

Implementación y evidencia automatizada:

- el fallback acepta únicamente `media` cuando Electron omite simultáneamente
  `webContents`, `requestingOrigin`, `securityOrigin`, `requestingUrl` y
  `embeddingOrigin`; el handler está instalado sobre la partición aislada del
  navegador y la respuesta sólo habilita la consulta previa;
- un origen explícito no HTTP(S), cualquier permiso distinto y la solicitud
  real de cámara/micrófono siguen fallando cerrados; el request handler conserva
  instancia registrada, origen HTTP(S), decisión por sitio, HITL y permiso SO;
- se añadió una traza única para el preflight permitido y otra al arranque con
  el valor efectivo de `force-fieldtrials`, sin registrar URL, token ni datos de
  la cuenta;
- Vitest focal de `IntegratedBrowserService`: 38 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 65 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run harness:validate`,
  `npm run docs:check`, `npm run openspec:validate`, `npm run build:app` y
  `git diff --check` sobre el alcance: aprobados; el build conserva sólo avisos
  no bloqueantes ya existentes de chunks grandes e imports mixtos;
- el bundle generado contiene las trazas del field trial y del preflight, por
  lo que el siguiente `npm run dev` cargará ambas desde main.

`npm run verify:pr` volvió a aprobar adaptadores, arnés y cadena de suministro,
pero se detuvo en `docs:system:check` por las tres inconsistencias preexistentes
del worktree: referencia a `database/lia/migrations/sdo-tables.sql` eliminada,
catálogo global distinto de los 341 canales IPC derivados e inventario global
distinto de los 359 archivos de prueba derivados.

Hipótesis adversariales intentadas y resultado:

- permitir cualquier consulta anónima ampliaría capacidades no relacionadas:
  `geolocation`, permisos desconocidos y `background-sync` sin origen siguen
  denegados;
- un origen malformado podría degradarse al fallback: la presencia de cualquier
  origen explícito no vacío impide usarlo y `devtools://` está cubierto con
  pruebas tanto en `requestingOrigin` como en `securityOrigin`;
- el preflight podría sustituir la decisión del usuario: no puede hacerlo sin
  origen; la solicitud real posterior sí resuelve el store por origen y una
  negativa guardada continúa prevaleciendo;
- contenido externo podría capturar al recibir `true`: la prueba mantiene
  denegadas las solicitudes reales de una ventana no registrada y las que no
  aportan origen HTTP(S);
- la nueva observabilidad podía filtrar datos de Google: las trazas sólo
  contienen el nombre constante del field trial y el tipo de preflight.

Riesgo residual: todavía falta el smoke posterior a este ajuste porque exige
reiniciar el proceso Electron y una llamada externa con la cuenta del usuario.
El arranque debe registrar `Field trials WebRTC configurados: WebRTC-
SdpBundlePayloadTypeCollisionCheck/Disabled/`; al pulsar la llamada debe
registrar `Preflight media sin identidad ni origen: permitido` en lugar de la
negativa anterior. Después debe aparecer la solicitud de `meet.google.com` si
Meet alcanza `getUserMedia`. La línea BUNDLE puede permanecer porque WebRTC la
emite antes de decidir si devuelve el error.

## Seguimiento: identidad `undefined` en Electron 43.3

El smoke real posterior reveló que la consulta seguía entrando por la negativa
de contenido ajeno y nunca emitía la traza del preflight permitido. La causa fue
una divergencia nullish: el contrato público representa `webContents` ausente
como `null`, pero el runtime Electron 43.3 entregó `undefined`. La comparación
estricta con `null` rechazaba el preflight antes de aplicar el fallback acotado.

El ajuste normaliza `null` y `undefined` únicamente cuando la consulta es
`media`, no existe origen resoluble ni campo de origen explícito y la clase de
permiso es cámara o micrófono. El request handler no cambió: una solicitud real
sigue necesitando `webContents` registrado, origen HTTP(S), decisión por sitio,
aviso HITL y permiso nativo.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 38/38 casos aprobados, incluido
  `webContents = undefined` y el rechazo de `requestingOrigin = devtools://`;
- suite dirigida de permisos y navegador: 6 archivos, 65/65 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npm run openspec:validate` y
  `npm run build:app`: aprobados;
- `git diff --check` sobre el alcance: aprobado, con avisos de conversión
  LF/CRLF sin errores de whitespace.

La revisión adversarial confirmó que otros permisos, orígenes explícitos
inválidos y solicitudes reales no registradas permanecen denegados. También
detectó que `requestingOrigin` debía cancelar explícitamente el fallback; se
añadió al conjunto junto con su regresión. Falta únicamente repetir el smoke
real tras detener por completo los procesos Electron y arrancar de nuevo.

## Seguimiento: asignación de payloads por transporte

El smoke real posterior confirmó que
`WebRTC-SdpBundlePayloadTypeCollisionCheck/Disabled/` sí llegaba al arranque,
pero la llamada seguía fallando con `StartupCode 219`. La secuencia del terminal
ubicó la negativa anónima de `media` durante el arranque de Gmail, antes del
clic; después de `Apertura sin destino permitida como ventana real` aparecieron
las dos líneas de colisión BUNDLE. Por tanto, esa negativa previa no explica el
fallo de la llamada y no se ampliaron permisos nuevamente.

La revisión del código y documentación upstream de WebRTC mostró que desactivar
el rechazo estricto no modifica la asignación que produjo el conflicto. El
binario Electron 43.3.0 contiene el trial `WebRTC-PayloadTypesInTransport`, cuyo
rediseño asigna payload types con alcance de transporte durante oferta/respuesta.
Main ahora habilita ese trial y conserva el modo permisivo para SDP heredado,
ambos antes de `app.ready`.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 39/39 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 66/66 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run harness:validate`,
  `npm run docs:check`, `npm run openspec:validate` y `npm run build:app`:
  aprobados;
- `git diff --check` sobre el alcance: aprobado, con avisos LF/CRLF sin errores;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las mismas tres inconsistencias globales preexistentes de
  `docs:system:check`: migración SDO eliminada aún referenciada, catálogo IPC
  distinto de los 341 canales derivados e inventario distinto de los 359
  archivos de prueba derivados.

Hipótesis adversariales intentadas:

- ampliar permisos podía ocultar la causa: se descartó; el cambio no modifica
  ningún check/request y la suite conserva los rechazos de origen e identidad;
- un trial mal escrito quedaría ignorado: la constante exacta está cubierta y
  el nombre existe dentro del binario Electron instalado;
- la nueva traza podía filtrar URL o cuenta: solo informa `sí`/`no` sobre la
  adopción de la ventana hija;
- el rediseño afecta todo WebRTC del proceso: es el riesgo residual conocido;
  no cambia acceso a dispositivos y se revierte retirando
  `WebRTC-PayloadTypesInTransport/Enabled` de la constante.

Falta el smoke real posterior porque los field trials solo se cargan al crear
el proceso Electron. El nuevo arranque debe mostrar la cadena con ambos trials
y, al pulsar la llamada, `Ventana real adoptada antes de entregarla: sí`.

## Resolución: fallback compatible para la llamada directa de Google Chat

El smoke real posterior refutó la hipótesis anterior: aun con ambos field trials
activos, la ruta `https://meet.google.com/call?...` siguió terminando en
`DisconnectedError` con `StartupCode 219`. La documentación oficial de Google
distingue la reunión Meet convencional de la llamada directa y limita esta
última, iniciada desde Chat o Gmail, a Chrome. Por ello se retiraron por completo
los trials experimentales que afectaban todo WebRTC del proceso.

El navegador ahora reconoce únicamente HTTPS con host exacto
`meet.google.com` y pathname `/call` o `/call/`. Cancela esa navegación dentro
de Electron y la entrega a `shell.openExternal`; Gmail queda abierto en SofLIA.
La protección cubre un destino recibido directamente, una navegación o
redirección posterior desde `about:blank` y una navegación en la pestaña
principal. Una ventana de 1.500 ms deduplica ráfagas, y se reinicia de inmediato
si la apertura externa falla. Reuniones Meet estándar, `/calling`, descendientes
de `/call` y otros hosts continúan dentro del navegador integrado.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 41/41 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 68/68 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npm run openspec:validate` y
  `npm run build:app`: aprobados;
- `git diff --check` sobre el alcance: aprobado, con avisos LF/CRLF sin errores;
- el código fuente y el bundle generado no contienen `force-fieldtrials`,
  `WebRTC-PayloadTypesInTransport` ni
  `WebRTC-SdpBundlePayloadTypeCollisionCheck`; el bundle sí contiene el nuevo
  fallback acotado;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y volvió
  a detenerse en las tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Revisión adversarial:

- un host o pathname parecido podía provocar una apertura externa: protocolo,
  hostname y pathname exactos están separados y cubiertos con casos negativos;
- navegación y redirección del mismo popup, doble clic o dos aperturas en ráfaga
  podían duplicar Chrome: existe deduplicación por popup y global de 1.500 ms;
- una falla del navegador del sistema podía quedar silenciosa o bloquear un
  reintento: el error se publica en la pestaña y el cooldown se libera al fallar;
- la URL de Google puede contener estado de sesión: se entrega únicamente al
  sistema operativo y la traza no registra URL, query, cuenta ni token;
- no se amplió la gobernanza de permisos, protocolos generales ni la confianza
  de otros `webContents`; las regresiones previas permanecen aprobadas.

Riesgo residual: `shell.openExternal` usa el navegador predeterminado. Para la
llamada directa debe ser Chrome y tener disponible la sesión de Google adecuada.
El smoke final requiere reiniciar Electron, pulsar la llamada y comprobar la
traza `Llamada directa de Google Chat delegada al navegador del sistema.`; no
debe aparecer ninguna traza de field trials. Una reunión Meet con código normal
debe seguir abriendo dentro de SofLIA.

## Seguimiento: la llamada directa se carga en un subframe

Las capturas del smoke posterior mostraron que el fallback anterior tampoco
alcanzaba a ejecutarse: el terminal registró `Apertura sin destino permitida
como ventana real`, pero no la traza de delegación, y luego Chromium volvió a
informar la colisión BUNDLE. En DevTools, `meet.google.com/call` continuó con
`DisconnectedError` y `StartupCode 219`. Esto descartó que la apertura externa
estuviera fallando; Google conservaba el popup en `about:blank` y cargaba la
llamada directa en un frame interno.

La documentación oficial de Electron distingue `will-navigate`, limitado al
frame principal, de `will-frame-navigate`, emitido para cualquier frame y
cancelable con `preventDefault`. El navegador ahora intercepta la ruta HTTPS
exacta `/call` en ese evento y también antes de una redirección de subframe,
tanto en la pestaña como en el popup adoptado. La delegación exige además que el
abridor sea `mail.google.com` o `chat.google.com`, de modo que otro sitio no
puede provocar una apertura externa incrustando esa URL. Fuentes:
[Electron `webContents`](https://www.electronjs.org/docs/latest/api/web-contents)
y [llamadas desde Google Chat](https://support.google.com/chat/answer/7653283).

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 43/43 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 70/70 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npm run openspec:validate` y
  `npm run build:app`: aprobados;
- `git diff --check`: aprobado, con avisos LF/CRLF sin errores de whitespace;
- el bundle generado contiene `will-frame-navigate`, la validación del abridor
  Gmail/Chat y la traza de delegación;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las mismas tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Revisión adversarial:

- una página arbitraria podía incrustar la ruta exacta y abrir el navegador:
  la fuente queda limitada a Gmail/Chat y existe una regresión negativa;
- una redirección de subframe podía eludir el listener nuevo: la comprobación
  directa ocurre antes de descartar redirecciones que no son del frame principal;
- frame, redirección y doble clic podían repetir la apertura: las deduplicaciones
  local y global permanecen cubiertas y `shell.openExternal` se invoca una vez;
- una reunión normal o un frame parecido podían ser cancelados: la comparación
  sigue siendo host y pathname exactos, y ambos casos permanecen dentro;
- no se ampliaron permisos ni protocolos y la URL con tokens no se escribe en
  logs; únicamente se entrega al navegador del sistema.

Riesgo residual: la llamada directa depende de que Chrome sea el navegador
predeterminado y tenga la cuenta de Google adecuada. El smoke final debe hacerse
tras cerrar todos los procesos Electron y arrancar de nuevo. Al pulsar la llamada
debe aparecer inmediatamente la traza de delegación y abrirse Chrome antes de
que Chromium integrado alcance las líneas BUNDLE.

## Seguimiento: `/call` no es un enlace transferible

El smoke real posterior confirmó que la interceptación del subframe sí funcionó:
desaparecieron `StartupCode 219` y la colisión BUNDLE, y el terminal registró tres
intentos de delegación. Sin embargo, Chrome recibió la URL interna
`meet.google.com/call?...` separada del estado vivo de Google Chat y terminó en
`meet.google.com/_meet/whoops` con el mensaje "Se produjo un error al comenzar
esta videollamada". Por tanto, abrir `/call` externamente tampoco inicia una
llamada válida.

La ayuda oficial de Google exige Chrome y describe que la llamada directa se
inicia desde el mensaje directo de Chat o Gmail; no publica `/call` como enlace
compartible. El fallback conserva la detección exacta, pero `shell.openExternal`
recibe ahora la URL HTTPS de la conversación iniciadora. SofLIA informa que el
usuario debe finalizar el intento rojo pendiente, si existe, y repetir la llamada
en la conversación abierta en Chrome. No se afirma que el traspaso ejecute el
segundo clic ni se intenta controlar otro perfil del navegador.

Evidencia ejecutada el 2026-08-11:

- pruebas focales del traspaso: 5/5 casos aprobados;
- suite dirigida de servicio, handlers, validación, SSO, wrapper y aviso de
  permisos: 6 archivos y 71/71 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npm run openspec:validate` y
  `npm run build:app`: aprobados;
- `git diff --check`: aprobado, con avisos LF/CRLF sin errores de whitespace;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las mismas tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Revisión adversarial:

- la URL de `/call` podía volver a salir por otra rama: todas las rutas directa,
  navegación, redirección, frame y popup llaman al mismo handoff con el abridor;
- un sitio ajeno podía intentar abrir una conversación o `/call`: protocolo y
  host del abridor siguen limitados exactamente a Gmail y Google Chat, con caso
  negativo;
- una ráfaga podía abrir varias conversaciones: la deduplicación global y local
  conserva una sola invocación externa;
- cambiar de pestaña mientras Windows abre Chrome podía publicar la instrucción
  en la pestaña equivocada: el id de origen se captura antes del efecto y una
  regresión mantiene el aviso en esa pestaña;
- un fallo de `shell.openExternal` libera el cooldown y deja error visible; los
  logs no incluyen la conversación, el id del mensaje directo ni parámetros de
  `/call`.

Riesgo residual confirmado: Electron no puede transferir cookies ni elegir la
cuenta de un perfil Chrome externo, y Google no ofrece un contrato público para
reproducir automáticamente el clic de llamada. Si el navegador predeterminado no
es Chrome o usa otra cuenta, el usuario debe abrir la conversación con el perfil
correcto. El smoke final debe comprobar que se abre la conversación, no
`/_meet/whoops`, y que `/call` ya no aparece en la barra externa.

## Resolución final: reunión Meet estándar en una pestaña interna

El smoke posterior confirmó que abrir la conversación iniciadora en Chrome no
cumplía el contrato de producto: abandonaba SofLIA y aun requería repetir el
clic manualmente. La [ayuda oficial de Google Chat](https://support.google.com/chat/answer/7653283)
separa las reuniones Meet estándar de las llamadas directas y limita estas
últimas a Chat o Gmail en Chrome. No existe un contrato público para reproducir
su timbrado dentro de Electron.

El fallback externo queda sustituido. Todas las ramas ya existentes que detectan
el destino HTTPS exacto `meet.google.com/call` desde Gmail o Chat cancelan ese
flujo antes de WebRTC y crean una única pestaña interna
`https://meet.google.com/new`. La pestaña usa `browserPartitionFor()`, por lo que
conserva la misma sesión aislada del usuario; Gmail continúa abierto y no se
invoca `shell.openExternal`. La alternativa es una reunión Meet estándar: no
hace sonar al destinatario y el enlace debe compartirse desde Chat.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 42/42 casos aprobados;
- suite dirigida de servicio, handlers, validación, permisos por sitio y wrapper:
  5 archivos y 64/64 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npm run openspec:validate` y
  `npm run build:app`: aprobados;
- `git diff --check` sobre el alcance: aprobado, con avisos LF/CRLF sin errores
  de whitespace;
- el bundle activo contiene la traza de sustitución y
  `https://meet.google.com/new`; el servicio fuente no importa ni invoca
  `shell.openExternal`;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Revisión adversarial:

- un sitio ajeno podía forzar la creación de una reunión: la fuente continúa
  limitada a `mail.google.com` o `chat.google.com` y el caso negativo no crea
  ninguna pestaña;
- un host o pathname parecido podía cancelar navegación legítima: solo HTTPS,
  host exacto y pathname `/call` o `/call/` activan el fallback; `/calling` y
  reuniones convencionales permanecen internas;
- popup, frame y redirección podían crear varias reuniones: la guarda local y
  la deduplicación global de 1.500 ms producen una sola pestaña;
- una ruta residual podía seguir abriendo Chrome: todas las entradas convergen
  en `openStandardMeetInsideBrowser` y el servicio ya no depende de `shell`;
- una falla al crear o cargar la pestaña podía bloquear el reintento: el error
  se asocia a la pestaña iniciadora y libera el cooldown;
- no se ampliaron permisos, protocolos ni confianza de otros `webContents`, y
  ninguna URL de conversación o parámetro de `/call` se escribe en logs.

Riesgo residual: esta degradación no puede conservar la semántica de llamada
directa ni hacer sonar al destinatario. El smoke manual final requiere reiniciar
Electron, pulsar el botón de llamada y comprobar que aparece dentro de SofLIA
una pestaña de reunión Meet estándar, sin abrir Chrome. Después se comparte el
enlace con la otra persona desde Chat.

## Ajuste de experiencia: reunión alternativa en ventana compacta

El smoke del 2026-08-11 mostró que la reunión alternativa ya no abría Chrome,
pero sí activaba automáticamente una pestaña completa. El comportamiento
solicitado es el de una superficie de llamada compacta: Gmail permanece visible,
la ventana puede moverse y el usuario decide si quiere convertirla en pestaña.

`IntegratedBrowserService` crea `https://meet.google.com/new` en segundo plano y
mueve la misma `WebContentsView` a una `BaseWindow` sin marco de 400 x 300 px,
flotante y ubicada en la esquina inferior derecha de la ventana anfitriona. Una
barra local arrastrable ofrece "Mover a una pestaña" y "Cerrar reunión". La
primera operación reintegra la vista existente, actualiza el tab activo y no
ejecuta otra carga; la segunda destruye solo la pestaña de Meet. La barra usa
`data:`, CSP sin red ni scripts, `sandbox`, aislamiento de contexto y Node
desactivado; cualquier navegación distinta de sus dos acciones exactas se
cancela. No se agregaron canales IPC ni acceso a `shell`.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 44/44 casos aprobados;
- suite dirigida de servicio, handlers, validación y wrapper renderer: 4
  archivos y 59/59 casos aprobados;
- `npm run typecheck`, `npm run lint:changed`, `npm run docs:check`,
  `npm run harness:validate`, `npx openspec validate
  evolve-integrated-browser-workspace --strict` y `npm run build:app`:
  aprobados; `build:app` también completó dentro de `npm run build`;
- `git diff --check`: aprobado, con avisos LF/CRLF sin errores de whitespace;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las mismas tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados;
- `npm run build` completó typecheck y los bundles renderer/main/preload, pero la
  fase posterior de preparación de Python no pudo descargar el runtime por
  `connect EACCES` hacia GitHub; no es un fallo de compilación del cambio.

Revisión adversarial:

- una ráfaga de popup, frame y redirección podía abrir varias ventanas: la
  deduplicación existente mantiene una sola reunión compacta;
- enfocar la ventana compacta podía cambiar la pestaña activa de Gmail: esta
  presentación no adopta el foco como `activeTabId`; solo la acción explícita de
  reintegración activa Meet;
- reintegrar podía crear otra vista, perder cookies o recargar: la prueba
  conserva identidad de `WebContentsView`, host y contador de `loadURL`;
- destruir la barra dentro de su propio `will-navigate` podía producir estado
  reentrante: la operación se difiere un microtask y se acepta una sola acción;
- una URL inventada podía usar la barra como navegador: toda navegación se
  cancela y el caso negativo conserva la reunión separada;
- cerrar la ventana o su botón podía cerrar Gmail o dejar vistas huérfanas: se
  destruyen la vista de reunión, la barra y la ventana compacta, mientras la
  pestaña iniciadora permanece abierta; el cambio de usuario también limpia las
  dos vistas.

Riesgo residual confirmado: la ventana compacta reproduce la presentación y el
traspaso a pestaña, no el protocolo propietario de llamada directa de Google
Chat. Sigue siendo una reunión Meet estándar y no hace sonar al destinatario; el
enlace debe compartirse desde Chat. Además, el smoke real en Electron continúa
siendo obligatorio porque las pruebas no pueden validar composición nativa,
arrastre ni compatibilidad WebRTC del host.

## Guarda de gesto contra aperturas automáticas de Meet

El smoke del 2026-08-11 mostró dos fallos consecutivos. Gmail podía restaurar o
reintentar su estado interno de llamada y volver a emitir `/call` sin que el
usuario pulsara el botón; después, la primera guarda impedía también el clic
real porque la conversación activa y `Llamar a <persona>` viven dentro de un
iframe y el listener del documento superior nunca recibe ese evento.

El servicio instala una sonda idempotente en cada frame y escucha
`before-mouse-event` en el `WebContents`. Electron emite primero el `mouseDown`;
el listener del frame confirma después que el target confiable era el control
de llamada. Solo si ambas señales se correlacionan en 500 ms se arma una
autorización de 1.500 ms asociada a la pestaña. La primera navegación `/call` la
elimina y solo la acepta si sigue vigente. Clic genérico, baliza aislada, botón
derecho, token vencido y cualquier intento posterior fallan cerrados. Toda ruta
`/call` se cancela antes de WebRTC. No se añadieron IPC, preload, permisos ni
apertura externa.

Evidencia ejecutada el 2026-08-11:

- prueba focal de `IntegratedBrowserService`: 47/47 casos aprobados;
- suite dirigida de servicio, handlers, validación y wrapper renderer: 4
  archivos y 62/62 casos aprobados;
- `npm run typecheck`, `npm run docs:check`, `npm run harness:validate`,
  `npm run lint:changed` y `npx openspec validate
  evolve-integrated-browser-workspace --strict`: aprobados;
- `git diff --check`: aprobado, con avisos LF/CRLF sin errores de whitespace;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en las tres inconsistencias globales preexistentes de
  `docs:system:check`: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Revisión adversarial de la corrección del iframe:

- una restauración inicial sin gesto no crea pestaña ni ventana, aunque el
  destino exacto `/call` se cancela;
- después de una apertura autorizada, cerrar Meet y reemitir `/call` tras vencer
  el cooldown tampoco crea otra ventana porque el gesto ya fue consumido;
- varios eventos de popup, frame o redirección solo pueden consumir una vez el
  timestamp guardado en main para esa pestaña;
- un clic izquierdo genérico o una baliza sin el evento nativo correlacionado no
  arman la guarda;
- el botón derecho no arma la guarda y un token de más de 1.500 ms se elimina
  aunque el destino exacto `/call` se cancele;
- el estado vive en main y no se expone al JavaScript de Gmail, Chat o Meet;
- no se depende del idioma, etiqueta accesible ni estructura DOM del control;
- la instalación idempotente se verificó tanto en el frame principal como en
  el iframe de Chat;
- sitios ajenos, hosts similares, rutas descendientes, reuniones estándar y
  protocolos no permitidos conservan las guardas anteriores.

Riesgo residual: la correlación depende de que Google conserve una etiqueta
accesible reconocible en el control y de que Electron entregue su consola de
frame dentro de 500 ms. Si cambia, la guarda falla cerrada y el modal no abre;
no reaparecen ventanas automáticas. El smoke manual debe reiniciar Electron,
confirmar que no aparece Meet durante varios minutos de uso pasivo y después
pulsar una sola vez el botón de llamada para verificar que aparece exactamente
una ventana compacta. La alternativa sigue siendo una reunión estándar: no
hace sonar al destinatario ni crea el icono o registro de llamada directa.

## Corrección: llamada directa nativa en Chromium

La evidencia aportada el 2026-08-11 en Brave y Comet refuta la conclusión
anterior de que el flujo dependía del ejecutable Google Chrome. Ambos clientes
Chromium muestran el registro de llamada en Chat, timbrado y la ventana compacta
con acción para moverla a una pestaña. La ayuda de Google describe esas mismas
propiedades, aunque use “Chrome” como cliente soportado. Electron documenta que
una ventana creada por `window.open` conserva preferencias de seguridad del
abridor y que `setWindowOpenHandler.createWindow` debe construirla con las
opciones recibidas.

La comparación local encontró Brave y Comet sobre Chromium 151, mientras
SofLIA ejecutaba Electron 43.3.0 con Chromium 150.0.7871.212. Además, el servicio
cancelaba deliberadamente `meet.google.com/call`, eliminaba el contexto del
abridor y fabricaba una reunión distinta en `/new`; por diseño esa alternativa
no podía crear el icono ni hacer sonar al destinatario. Se retiraron por completo
el fallback, la sonda de gesto, sus tokens y la barra compacta local. `/call`
queda permitido tanto en navegación como en subframes, y una solicitud de
ventana desde Gmail/Chat crea y registra una hija real antes de devolver su
`webContents` a Chromium. La allowlist de protocolos y la gobernanza de cámara y
micrófono permanecen vigentes.

Electron se fijó exactamente en `44.0.0-beta.3`, que incorpora Chromium 152. La
instalación binaria no pudo completarse porque la aplicación en ejecución
mantenía bloqueado `node_modules/electron/dist/resources/default_app.asar`; se
actualizaron manifiesto y lockfile sin cerrar procesos del usuario. El smoke
queda pendiente hasta detener la app, ejecutar `npm install` y arrancar de nuevo.

Evidencia automatizada de esta corrección:

- `npx vitest run electron/__tests__/integrated-browser-service.test.ts --project main`: 41/41 casos aprobados;
- handlers, validación y wrapper renderer ejecutados por separado: 15/15 casos aprobados;
- la regresión comprueba que `/call` recibe `allow`, conserva una ventana real y
  no crea `/new` ni ventana separada del navegador propio;
- las navegaciones `/call` en subframe y popup no se cancelan;
- `file://` dentro del popup continúa cancelado;
- `npm run typecheck`, ESLint dirigido, `npm run docs:check`,
  `npm run harness:validate`, `npm run build:app`, OpenSpec estricto y
  `git diff --check`: aprobados;
- la ejecución conjunta de los cuatro archivos produjo una vez un timeout en
  una prueba previa de permiso nativo; el archivo completo y los otros tres
  grupos aprobaron por separado inmediatamente después;
- `docs:system:check` conserva tres fallos globales preexistentes y ajenos a
  esta corrección: referencia a la migración SDO eliminada, catálogo distinto
  de los 341 canales IPC derivados e inventario distinto de los 359 archivos de
  prueba derivados.

Riesgo residual: las pruebas unitarias no ejecutan el servicio remoto de Google
ni el binario nuevo. El único criterio de cierre válido es un smoke entre dos
cuentas con la app reiniciada que compruebe, en este orden: ningún popup durante
uso pasivo, un solo popup tras el clic, icono en Chat, timbrado remoto, audio,
ventana compacta, movimiento a pestaña y cierre sin reapertura.

## Reparación efectiva del runtime Electron 44

Verificación ejecutada el 2026-08-12 después de comparar el HAR funcional de
Brave con el HAR fallido de SofLIA. El manifiesto y el lockfile ya declaraban
`44.0.0-beta.3`, pero la carpeta instalada y `electron.exe` continuaban en
`43.3.0`; `npm ls` tomaba la versión del lock y ocultaba ese estado parcial.
No había procesos Electron activos. Se retiró la carpeta obsoleta, se reinstaló
el paquete exacto y se ejecutó su instalador versionado porque la política local
de scripts de npm había dejado pendiente la descarga del binario.

La comprobación directa del ejecutable, sin depender de metadata de npm,
registró Electron `44.0.0-beta.3`, Chromium `152.0.7977.30`, Node `24.18.1` y
ABI de módulos `149`. Los tipos reales de Electron 44 revelaron dos cambios de
compatibilidad que el árbol 43 no mostraba: el portapapeles pasó a operaciones
asíncronas y `openAsHidden` dejó de formar parte de `Settings`. Los consumidores
esperan ahora lectura y escritura antes de publicar éxito, el pegado restaura el
portapapeles también ante error y el instalador de inicio de Windows conserva
`openAtLogin`, `path` y `args`.

Evidencia ejecutada sobre la instalación reparada:

- `npm run typecheck`: aprobado;
- suites focales de Computer Use e `IntegratedBrowserService`: 2 archivos y
  136/136 casos aprobados;
- ESLint dirigido a los nueve archivos TypeScript afectados: aprobado;
- `npm run harness:validate`: aprobado, 25 rutas y 8 skills canónicas;
- `npm run docs:check`: aprobado, enlaces válidos en 182 documentos activos;
- `vite build --config vite.config.mts`: aprobado; renderer, main y preload
  generados. La transformación CSS consumió 251 segundos y produjo los avisos
  no bloqueantes ya conocidos de chunks grandes e imports mixtos;
- `npm run verify:pr` aprobó adaptadores, arnés y cadena de suministro, y se
  detuvo en `docs:system:check` porque el catálogo global no coincide con los
  343 canales IPC derivados; es deuda ajena a esta reparación;
- `npm run lint:changed` se detuvo por `_sourceId` no usado en el archivo
  ajeno y no versionado `electron/desktop-context/inventory.ts`; no se modificó
  para cerrar esta reparación.

La sonda `electron-rebuild -f -w better-sqlite3` no encontró ese paquete en el
árbol actual y avanzó a `active-win`; su compilación opcional se detuvo porque
Windows no tiene Visual Studio Build Tools. El build de aplicación no depende de
esa compilación y `active-win` mantiene su degradación controlada ya existente.
No se instalaron herramientas globales ni se ejecutó `npm audit fix --force`.

Riesgo residual: la instalación y el build ya prueban el runtime correcto, pero
la llamada de Google sigue requiriendo el smoke entre dos cuentas. El siguiente
HAR debe mostrar User-Agent sin `Electron`, carga de NetEq,
`CreateMeetingDevice` y `CreateMeetingInvite` antes de declarar resuelto el
timbrado.

## Corrección de identidad en subframes y workers de Electron 44

El smoke del 2026-08-12 con el runtime reparado seguía terminando en
`DisconnectedError` con `StartupCode 219`. La comparación del nuevo HAR con el
HAR funcional de Brave localizó una diferencia que la inspección anterior del
documento principal no mostraba:

- Brave envió 145 de 149 solicitudes con un User-Agent de Chrome 151 limpio;
- SofLIA envió 137 de 142 solicitudes de Chat/Meet con
  `soflia-hub-desktop/0.9.6` y `Electron/44.0.0-beta.3`;
- solo cuatro solicitudes de SofLIA usaron el override de la vista, y este
  quedó mal formado como `Chrome/152.0.7977.30-beta.3` porque el normalizador
  consumía únicamente la parte numérica de la versión Electron;
- ambos flujos alcanzaron `CreateMediaSession`, pero solo Brave cargó
  `loadNetEqWrapper` y continuó por `CreateMeetingDevice`,
  `UpdateMeetingDevice` y `CreateMeetingInvite`.

La causa era doble: `webContents.setUserAgent` no cubría workers ni ciertos
subframes cruzados en Chromium 152, y la expresión regular había sido escrita
para versiones estables. Main deriva ahora una única cadena Chromium, elimina
completo el sufijo prerelease y la aplica tanto a `WebContents` como a su
`Session`. La ventana hija recibe la misma preparación. No se falsifica una
versión distinta del Chromium incluido ni se inyectan Client Hints.

El terminal también registró una consulta anónima de `media` junto a consultas
de `devtools://devtools`, antes del intento. No se amplió esa excepción porque
la evidencia no la vincula con el corte de red y los fallos reales ya demostraron
que alterar permisos no resolvía el 219. Solicitudes de captura, origen,
decisión por sitio, aviso HITL y permiso nativo permanecen sin cambios.

La captura `mailsoflia.google.com`, guardada dentro del repositorio mientras
DevTools aún la mantenía bloqueada, provocó además que Vite terminara con
`EBUSY` al intentar observarla. El watcher ignora ahora `*.har` y ese patrón de
captura; `.gitignore` evita que archivos con estado de sesión entren al control
de versiones.

Evidencia automatizada:

- prueba focal de `IntegratedBrowserService`: 42/42 casos aprobados;
- suite dirigida de servicio, permisos, handlers, validación y wrapper
  renderer: 5 archivos y 64/64 casos aprobados;
- la regresión usa exactamente `Electron/44.0.0-beta.3` y exige
  `Chrome/152.0.7977.30` limpio tanto en la vista como en la sesión y la ventana
  hija;
- `npm run typecheck`, `npm run lint:changed`, `npm run harness:validate`,
  `npm run docs:check`, OpenSpec estricto, `npm run build:app` y
  `git diff --check`: aprobados;
- `npm test` global no produjo un resultado final: superó el límite acotado de
  244 segundos. No se contabiliza como aprobado ni como fallo de una prueba;
  las suites del alcance sí terminaron de forma determinista.

Revisión adversarial:

- aplicar el override globalmente podía afectar otros perfiles: solo se aplica
  a la `Session` de la partición aislada que ya comparte el navegador integrado;
- fijar un Chrome inventado podía desalinear Client Hints: la cadena se deriva
  del binario Electron y solo se quitan los dos tokens propios;
- un regex parcial podía volver a dejar `alpha`, `beta` o `nightly`: el patrón
  consume el sufijo prerelease completo y la prueba cubre el beta instalado;
- normalizar la sesión no convierte otros `webContents` en gobernados ni cambia
  permisos, protocolos, `window.opener`, partición o navegación `/call`;
- los HAR podían filtrar cookies o tokens al commit: ambos patrones quedan
  ignorados y no se incluyeron contenidos sensibles en logs ni documentación.

Riesgo residual: falta el smoke de la tarea 38.4 porque requiere dos cuentas y
una acción humana. Tras cerrar por completo el proceso anterior y arrancar de
nuevo, el HAR debe quedar sin `Electron` ni `soflia-hub-desktop` en todas las
solicitudes de Chat/Meet, cargar `loadNetEqWrapper` y alcanzar
`CreateMeetingDevice` y `CreateMeetingInvite`. Solo entonces puede cerrarse el
timbrado extremo a extremo.

## Segundo diagnóstico en vivo: fallback global y runtime estable

Fecha: 2026-08-12. Se inspeccionaron el HAR nuevo
`mailsoflia.google.com`, la consola exportada, el DOM/DevTools de la instancia
Electron y una reunión funcional abierta en Chrome. La evidencia corrige la
conclusión de la iteración anterior:

- SofLIA sí crea el iframe de Chat, pero los `FetchEvent` de
  `meet.google.com/call` y `meet.google.com/_/frame?...pip_frame` terminan en
  error de red y la promesa se rechaza;
- el documento superior ya muestra un UA Chromium limpio, pero el HAR conserva
  `soflia-hub-desktop/0.9.6` y `Electron/44.0.0-beta.3` en casi todas las
  solicitudes de Meet, incluido `CreateMediaSession` y el web worker;
- Brave alcanza `loadNetEqWrapper`, `CreateMeetingDevice`,
  `UpdateMeetingDevice` y `CreateMeetingInvite`; SofLIA se detiene después de
  `CreateMediaSession` y nunca solicita NetEq;
- DevTools confirmó `SharedArrayBuffer` disponible con
  `crossOriginIsolated=false`. Por tanto, la bandera global sí estaba activa,
  pero no corregía el arranque y exponía una combinación de capacidades que no
  debe forzarse;
- Chrome mostró una reunión real activa con participantes y controles, lo que
  descarta un fallo general de la cuenta o del servicio de Google.

La corrección mueve la identidad Chromium a `app.userAgentFallback` antes de
crear cualquier sesión, worker o ventana. Se conservan los overrides de
`WebContents` y `Session` como defensa adicional. Se retiraron la habilitación
global de `SharedArrayBuffer` y las variables de diagnóstico que alteraban
features de Chromium. La instalación volvió de `44.0.0-beta.3` a Electron
`43.4.0`, última versión estable publicada el 2026-08-11; el paquete y el
ejecutable reportan ambos `43.4.0`.

Evidencia automatizada de esta iteración:

- regresiones de UA y `IntegratedBrowserService`: 1 archivo, 45/45 casos
  aprobados;
- `npm run harness:validate`: aprobado, 25 rutas y 8 skills canónicas;
- `git diff --check` del alcance: sin errores, únicamente avisos de conversión
  LF/CRLF del worktree;
- `npm run typecheck`: bloqueado por dos errores preexistentes y ajenos en
  `electron/clipboard-ai-assistant.ts` (líneas 47 y 84), donde el cambio de
  clipboard espera una promesa pero Electron entrega un string. El test nuevo
  ya no aporta errores al typecheck;
- `npm run verify:pr`: adaptadores, arnés, cadena de suministro, documentación
  de sistema, enlaces, semilla de skills y OpenSpec aprobaron; la compuerta se
  detuvo únicamente al llegar a los mismos dos errores de clipboard.

Riesgo residual: todavía se necesita una llamada real entre dos cuentas con el
proceso reiniciado. El criterio de cierre no cambia: todas las solicitudes de
Chat/Meet deben quedar sin marcas Electron/producto, debe cargar
`loadNetEqWrapper` y deben aparecer `CreateMeetingDevice` y
`CreateMeetingInvite`. Hasta obtener esa evidencia, la reparación del runtime y
la causa del corte están verificadas, pero el timbrado extremo a extremo no se
declara resuelto.

## Tercer diagnóstico: colisión BUNDLE aislada con identidad limpia

Fecha: 2026-08-12. El HAR de las 16:36 y la terminal de la instancia estable
permitieron separar la identidad del siguiente fallo:

- el HAR contiene 255 solicitudes; 249 llevan el User-Agent Chromium 150 limpio
  y las seis restantes no envían User-Agent. Ninguna anuncia `Electron` ni
  `soflia-hub-desktop`;
- Meet carga NetEq y completa con 200 `ResolveForHangoutsChat`,
  `CreateMediaSession`, `GetUser` y `GetSmartNotesEligibilities`, pero no emite
  `CreateMeetingDevice` ni `CreateMeetingInvite`;
- en esa frontera Chromium compara dos codecs Opus con payload 111. Ambos usan
  reloj 48 kHz, dos canales, `minptime=10` y `useinbandfec=1`, pero solo uno
  declara `stereo=1`; `set_remote_description` devuelve
  `INVALID_PARAMETER` por la colisión BUNDLE;
- el HAR solo registra dos solicitudes Meet con estado 0/aborto. Los
  `ERR_CACHE_MISS` de Gmail, Chat y widgets aparecen al desmontar el perfil
  anterior y no forman parte de las RPC que inician la llamada;
- Brave, bajo el mismo tipo de flujo, progresa desde `CreateMediaSession` a
  `CreateMeetingDevice`, múltiples `UpdateMeetingDevice` y
  `CreateMeetingInvite`.

La prueba antigua de field trials no aislaba esta variable: el HAR todavía
anunciaba Electron y se habilitaban simultáneamente el modo permisivo y
`WebRTC-PayloadTypesInTransport`. La implementación actual configura únicamente
`WebRTC-SdpBundlePayloadTypeCollisionCheck/Disabled/` antes de `app.ready`. El
trial pertenece al binario Electron 43.4 y hace que WebRTC conserve el
diagnóstico, pero no devuelva ese error. No se modifica SDP ni se toca la
gobernanza de dispositivos.

Evidencia automatizada:

- suite de compatibilidad WebRTC y servicio integrado: 2 archivos y 52/52 casos
  aprobados;
- ESLint focal y `npm run lint:changed`: aprobados; el incremental revisó 145
  archivos sin deuda nueva;
- build directo de Vite para renderer, main y preload: aprobado. El bundle de
  main contiene el trial BUNDLE y la guarda de versión, y no contiene
  `WebRTC-PayloadTypesInTransport`;
- `npm run harness:validate`, `npm run docs:check`,
  `npm run docs:system:check`, OpenSpec estricto y `git diff --check`: aprobados;
- `npm run verify:pr` aprobó adaptadores, arnés, cadena de suministro,
  documentación del sistema, enlaces, semilla de skills y OpenSpec; se detuvo
  en los dos errores preexistentes de `electron/clipboard-ai-assistant.ts`
  (líneas 47 y 84);
- `npm run build:app` hereda ese mismo typecheck y se detuvo antes de invocar
  Vite; por ello se ejecutó Vite directamente y no se declara `build:app` como
  aprobado.

Revisión adversarial:

- un trial global podía sobrevivir a una futura actualización y relajar WebRTC
  cuando ya no fuera necesario: la configuración se limita ahora al major 150
  de `process.versions.chrome`; 149, 151, 152 y valores inválidos no agregan el
  switch;
- el modo permisivo afecta todos los `RTCPeerConnection` de Chromium 150, no
  solo Meet: se documenta el alcance, no se oculta el diagnóstico y el rollback
  es retirar una llamada de arranque;
- reintroducir la asignación por transporte podía cambiar la negociación además
  de tolerar el SDP: pruebas y bundle confirman que ese trial está ausente;
- tolerar SDP podía confundirse con conceder captura: permisos, ventana
  registrada, origen, decisión por sitio, HITL y permiso nativo no cambiaron;
- la evidencia podía marcar como resuelto un smoke incompleto: las tareas 39.5
  y 40.2 siguen abiertas hasta observar `CreateMeetingDevice` y
  `CreateMeetingInvite` en un nuevo HAR.

Riesgo residual: es obligatorio cerrar por completo el proceso Electron actual,
arrancar con el nuevo main y repetir la llamada entre dos cuentas. Las dos
líneas BUNDLE pueden permanecer; el criterio causal es que aparezcan las RPC de
dispositivo e invitación y que el destinatario reciba el timbrado.

## Cuarto diagnóstico: el trial BUNDLE queda refutado

Fecha: 2026-08-12. Se compararon el HAR de SofLIA de las 16:56–16:57, la consola
de Meet y la terminal completa contra el HAR funcional de Brave:

- la terminal confirma que el proceso arrancó con la compatibilidad WebRTC de
  Chromium 150 configurada;
- desaparecieron por completo `BUNDLE`, `payload collision` e
  `INVALID_PARAMETER`, por lo que el trial sí estuvo activo y cambió esa ruta;
- Meet volvió a terminar en `DisconnectedError` con `StartupCode 219`;
- el HAR de SofLIA contiene 479 solicitudes, carga `loadNetEqWrapper`,
  `loadNetEqSabWrapper` y `MeetingsWebWorker`, y completa con 200
  `ResolveForHangoutsChat`, `CreateMediaSession`, `GetUser` y
  `GetSmartNotesEligibilities`;
- SofLIA no emite `CreateMeetingDevice` ni `CreateMeetingInvite`, mientras Brave
  sí emite ambas y continúa con `UpdateMeetingDevice` y
  `SyncMeetingSpaceCollections`;
- el servidor solicita Client Hints de alta entropía mediante `Accept-CH`, pero
  Electron 43.4.0 solo devuelve `sec-ch-ua` y `sec-ch-ua-platform`. Una prueba
  local mínima confirmó que retirar los overrides de sesión/contenido no cambia
  esa conducta; no se falsifican encabezados para ocultarla.

Conclusión: la colisión BUNDLE era correlación diagnóstica, no la causa del
corte. El trial global se retira. La diferencia reproducible restante frente a
los clientes funcionales es el motor: SofLIA usó Chromium 150 y Brave/Comet
Chromium 151.

## Quinto diagnóstico: runtime 44 reparado para una prueba limpia

Fecha: 2026-08-12. Con la aplicación detenida se instaló exactamente Electron
`44.0.0-beta.3`. El ejecutable descargado reporta Electron `44.0.0-beta.3` y
Chromium `152.0.7977.30`; una navegación local verificó que el fallback global
elimina `Electron/44.0.0-beta.3` desde la primera solicitud y conserva la versión
real del motor.

El intento anterior sobre esta beta no sirve como refutación del motor porque
el HAR todavía anunciaba Electron en la primera navegación, workers y RPC. Esta
es la primera combinación que aísla Chromium 152 con la identidad global ya
corregida. El cierre continúa condicionado al smoke entre dos cuentas: UA limpio,
`CreateMeetingDevice`, `CreateMeetingInvite`, timbrado, ventana compacta,
movimiento a pestaña y ausencia de aperturas espontáneas.

Verificación automatizada y de runtime de esta iteración:

- `npm ls electron --depth=0`, `package.json`, `package-lock.json` y el ejecutable
  coinciden en `44.0.0-beta.3`; el binario reporta Chromium `152.0.7977.30`;
- TypeScript de main/preload (`tsconfig.node.json`) aprobado;
- servicio y handlers del navegador: 2 archivos, 49/49 casos aprobados;
- build directo de Vite para renderer, main y preload aprobado;
- smoke local de arranque: main, renderer, GPU, red y audio iniciaron con
  Chromium 152 y se cerraron de forma controlada, sin error de ABI ni procesos
  restantes;
- `docs:check`, `docs:system:check`, `harness:validate`, `lint:changed` y OpenSpec
  estricto aprobados;
- `verify:pr` aprobó adaptadores, arnés, cadena de suministro, documentación,
  enlaces, semilla de skills y OpenSpec; se detuvo en cuatro usos de `Array.at`
  del archivo no versionado y ajeno
  `src/__tests__/components/BrowserPrivacyPanel.test.tsx`, antes de alcanzar el
  typecheck de main.

Revisión adversarial:

- no queda `force-fieldtrials`, `WebRTC-PayloadTypesInTransport` ni el módulo de
  compatibilidad BUNDLE en código o bundle;
- el paquete beta está fijado exactamente y el rollback estable queda
  documentado; no se usa un rango que pueda instalar otra beta sin revisión;
- no quedan scripts temporales ni procesos Electron del smoke;
- la denegación `media` para “contenido ajeno” del registro original aparece en
  el bloque de desmontaje del perfil junto con `web-app-installation`,
  `geolocation`, `devtools://` y `ERR_CACHE_MISS`, antes del popup gobernado; no
  se usa como explicación del `StartupCode 219`;
- para reducir exposición y trabajo del siguiente smoke, el servicio registra
  solo los nombres y estados de `CreateMediaSession`, `CreateMeetingDevice` y
  `CreateMeetingInvite`; una prueba negativa confirma que query y tokens no se
  imprimen.

Riesgo residual: el arranque y la instalación están reparados, pero todavía no
se declara resuelta la llamada extremo a extremo. Esa afirmación requiere el
único paso no automatizable sin afectar a otra persona: iniciar una llamada real
entre dos cuentas y observar los dos hitos finales y el timbrado.

## Fallback final: llamada directa en pestaña interna

Fecha: 2026-08-12. El smoke real sobre Electron `44.0.0-beta.3` / Chromium 152
volvió a mostrar `DisconnectedError` con `StartupCode 219`; no cambió el resultado
de la ventana compacta y no aparecieron `CreateMeetingDevice` ni
`CreateMeetingInvite`. A petición explícita del usuario se retiró esa ruta como
comportamiento de producto.

El servicio abre ahora la URL exacta `meet.google.com/call` como pestaña interna
activa de la misma partición autenticada. Se cubren tres formas observadas:
destino conocido en `window.open`, navegación o subframe de Gmail/Chat y popup
`about:blank` que después navega a `/call`. Los parámetros se conservan sin
reconstrucción ni registro; eventos repetidos con la misma URL activan la pestaña
existente. Document Picture-in-Picture, otros popups HTTP(S), protocolos y
permisos mantienen su gobernanza previa.

Evidencia automatizada:

- prueba focal de `IntegratedBrowserService`: 46/46 casos aprobados;
- suite dirigida de servicio y handlers: 49/49 casos aprobados;
- `npm run typecheck`: renderer, main y preload aprobados;
- `npm run lint:changed`: 149 archivos revisados sin deuda nueva;
- `npm run harness:validate`, `npm run docs:check` y OpenSpec estricto:
  aprobados;
- `npm run build:app`: renderer, main y preload generados correctamente;
- las regresiones exigen URL completa, pestaña activa, deduplicación, cobertura
  `about:blank -> /call`, subframe y ausencia de `meet.google.com/new`;
- los logs del fallback y de RPC no incluyen query, cookies ni tokens.

`npm run verify:pr` no produjo un resultado final: llegó a la suite global y
agotó el límite acotado de 364 segundos. Los procesos de esa ejecución quedaron
identificados por línea de comando y se cerraron; no se contabiliza la compuerta
como aprobada ni como fallo de una prueba. Las verificaciones deterministas del
alcance y el build sí terminaron con código cero.

Riesgo residual: una prueba automatizada no puede demostrar que otra cuenta
recibió una notificación real. Tras reiniciar SofLIA se debe pulsar la llamada y
confirmar en terminal `CreateMeetingDevice` y `CreateMeetingInvite`, además del
timbrado en el destinatario. Hasta entonces el fallback está implementado y
verificado, pero la entrega extremo a extremo no se declara resuelta.

## Retirada definitiva de la llamada directa

Fecha: 2026-08-13. Ante aperturas de reuniones sin una acción inequívoca del
usuario se retiró el fallback anterior. `IntegratedBrowserService` ya no crea,
transfiere, activa ni deduplica pestañas para `meet.google.com/call`; tampoco
observa RPC de Meet. La ruta exacta solicitada desde Gmail o Google Chat se
cancela en `window.open`, popups anidados, `about:blank -> /call`, navegación,
redirección y subframes, sin crear `/new`, abrir un navegador externo ni
simular una notificación.

La gobernanza general de cámara, micrófono, pantalla, notificaciones, popups y
Document Picture-in-Picture permanece intacta. Las referencias anteriores de
este documento describen iteraciones históricas y quedan sustituidas por esta
decisión de producto.

Evidencia automatizada inicial:

- matriz dirigida de retirada y permisos: 6/6 casos aprobados;
- suite dirigida de servicio y handlers: 47/48 casos aprobados; el único fallo
  pertenece al cambio concurrente del menú de selección y espera cero llamadas
  a JavaScript cuando el nuevo código deshabilita ese menú al tomar control;
- `npm run typecheck`: renderer, main y preload aprobados;
- `npm run build:app`: renderer, main y preload generados correctamente;
- `npm run harness:validate`, `npm run docs:check`,
  `npm run docs:system:check` y OpenSpec estricto: aprobados;
- las regresiones negativas verifican destino conocido, navegación,
  redirección, subframe, ventana anidada y `about:blank -> /call` sin crear
  pestañas ni ventanas de reunión; la ventana vacía adoptada también se cierra.

`npm run verify:pr` aprobó adaptadores, arnés, cadena de suministro,
documentación, semilla de skills y los 17 cambios OpenSpec. Se detuvo en
`lint:changed` por una asignación no usada en el archivo concurrente y ajeno
`electron/integrated-browser/selection-menu.ts`; no se contabiliza la compuerta
completa como aprobada.

Después de esa ejecución apareció además un archivo de prueba concurrente. La
repetición de `docs:system:check` exige ahora inventariar 368 archivos en vez de
367; el desajuste pertenece a ese trabajo ajeno y no se corrigió desde este
cambio.

Revisión adversarial:

- no quedan creadores, transferencias, deduplicación, activación ni observadores
  RPC de Meet;
- la URL se reconoce por protocolo, host y ruta exactos, no por coincidencia
  parcial, y sólo se bloquea cuando el origen heredado es Gmail o Google Chat;
- una ventana vacía que intenta convertirse en `/call` cancela la navegación y
  se cierra, evitando pestañas y ventanas fantasma;
- las pruebas de cámara, micrófono y popups ordinarios permanecen activas y
  aprobaron dentro de la matriz dirigida;
- no se ejecutó una llamada real ni se produjo una notificación externa.

Riesgo residual: una instancia de Electron ya abierta conserva el main anterior
hasta reiniciarse por completo. Los enlaces HTTP(S) normales siguen sujetos a
la gobernanza genérica; la protección específica sólo cancela `/call` cuando
proviene de Gmail o Google Chat.
