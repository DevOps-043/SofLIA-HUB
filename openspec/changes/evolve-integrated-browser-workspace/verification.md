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
