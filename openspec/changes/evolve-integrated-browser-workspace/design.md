## Context

El cambio `add-integrated-agent-browser` incorporó un único `WebContentsView` persistente y seguro, pero lo presenta como `activeView='browser'`, reemplazando todo el chat. La nueva solicitud convierte esa superficie en un modo colaborativo: navegador a ancho completo con chat SofLIA flotante, más persistencia de historial, credenciales y extensiones.

Electron 39 ofrece sesiones persistentes, `safeStorage` y carga de extensiones desempaquetadas por sesión. No incorpora el gestor de contraseñas de Chrome ni soporta Chrome Web Store o compatibilidad total con sus extensiones. El contenido remoto y las extensiones son fronteras no confiables; ninguna operación de credenciales o instalación se expone al agente runtime.

## Goals / Non-Goals

**Goals:**

- Mantener una sola instancia de chat flotante y un conjunto acotado de vistas web que comparten sesión, restaurables y compatibles con apertura del agente.
- Registrar navegación útil con límites, saneamiento y recuperación ante archivos parciales.
- Guardar credenciales por origen con cifrado del SO y rellenarlas únicamente por gesto explícito, sin enviar secretos al renderer o modelo.
- Administrar extensiones desempaquetadas compatibles mediante validación, confirmación, copia controlada, carga por sesión y remoción recuperable.
- Mantener el contrato Electron de cuatro capas y pruebas negativas por permisos, rutas, payload y ciclo de vida.

**Non-Goals:**

- Chrome Web Store, `.crx`, sincronización de perfil, compatibilidad total con Chrome o extensiones silenciosas.
- Capturar automáticamente envíos de formularios, mostrar contraseñas guardadas o permitir autofill al agente.
- Perfiles por organización, sincronización cloud de pestañas o datos del navegador y ventanas web desacopladas del workspace.

## Decisions

### Percepción adaptativa y compatibilidad de sitios

La observación continua se divide en dos costes. El temporizador pasivo conserva únicamente una captura visual reciente cada diez segundos como máximo; no ejecuta JavaScript ni recorre el DOM remoto. Un turno de chat, una herramienta DOM o Computer Use solicita explícitamente la observación completa, reutiliza esa captura si todavía corresponde a la misma pestaña/URL/revisión y extrae el DOM una sola vez. El walker completo limita nodos y descarta geometría fuera del viewport antes de consultar estilos, evitando miles de layouts forzados en aplicaciones grandes como YouTube.

La cadencia pasiva es adaptativa. Un único temporizador reprogramable sustituye al
intervalo fijo: mouse, teclado, scroll, navegación y resize abren una ventana de
calma antes de capturar, mientras una tarea de Computer Use nunca compite con el
muestreo pasivo. La evidencia periódica se limita a una imagen de hasta 1024 px
en su lado mayor y se codifica después de reducirla; la captura explícita de un
gestor conserva resolución completa porque debe reemplazar geométricamente la
vista nativa. Una revisión de contenido invalida la evidencia semántica anterior,
por lo que el siguiente turno forzado obtiene una imagen nueva aunque todavía no
haya vencido la cadencia periódica.

Cada `WebContentsView` deriva su User-Agent del Chromium incluido y elimina únicamente el token `Electron/<versión>`. No se fija una versión inventada ni se modifican cabeceras de red globales. Se conserva `backgroundThrottling: true`: la documentación de Electron indica que desactivarlo en un `WebContents` afecta a todos los contenidos de la ventana anfitriona, lo que rompería el presupuesto de recursos de pestañas ocultas y del propio chat.

### Geometría y apilado de las predicciones

El header mantiene un contexto de apilado superior al chat flotante para que el desplegable no quede recortado detrás de la conversación, mientras el viewport y su captura permanecen debajo. La captura puntual se monta en un contenedor con los mismos insets izquierdo y derecho publicados al `WebContentsView`; no se usa `object-cover`, porque ampliar la imagen al viewport completo altera la escala y oculta contenido. El ajuste exacto conserva la geometría CSS de la página durante toda la superposición.

### El modo navegador es estado ortogonal con chat superpuesto

`AppContent` mantiene `isBrowserWorkspaceOpen` por separado de la vista activa. Al abrirlo se renderiza un único `IntegratedBrowserPanel` y una única `AppChatView` compacta como tarjeta flotante; la Sidebar de navegación no se monta. El chat usa pointer capture, ancho entre 300 y 520 px y preferencias de ancho/lado en `localStorage`. Sus controles propios permiten moverlo entre izquierda y derecha o minimizarlo. Mientras está abierto, el `WebContentsView` permanece visible y recibe un inset equivalente al panel; al minimizarlo recupera todo el ancho sin recargar. Cerrar restaura la Sidebar y la vista anterior.

Esto evita dos controladores de chat simultáneos y conserva exactamente la conversación activa. Mantener `activeView='browser'` habría obligado a duplicar o desmontar el chat sin una región colaborativa.

### Pestañas acotadas y dos superficies nativas

`IntegratedBrowserService` administra hasta 500 pestañas lógicas en una misma partición persistente, pero mantiene como máximo ocho `WebContentsView` vivas. Las pestañas inactivas menos recientes se suspenden conservando URL, título y error saneados; al activarlas se recrea su vista en la misma sesión y se restaura la última URL. La pestaña activa y las dos superficies visibles nunca se suspenden. Cada pestaña conserva estado propio y el estado plano existente refleja la enfocada para mantener compatibilidad. `target=_blank` y `window.open` HTTP(S) se deniegan como ventanas externas y crean una pestaña interna. Protocolos no permitidos continúan bloqueados.

El límite de 500 describe registros de pestaña recuperables, no 500 procesos Chromium simultáneos. El presupuesto de ocho vistas limita memoria, CPU, timers y superficie de ataque; la recreación deliberadamente no promete restaurar el historial de atrás/adelante de una pestaña suspendida.

El renderer publica un único rectángulo disponible. Main calcula dentro de él los bounds de la vista principal y, opcionalmente, una secundaria: mitades iguales en `split` o una tarjeta inset superior derecha en `overlay`. Las demás vistas permanecen ocultas, no destruidas. El foco de una vista actualiza `activeTabId`; captura, navegación, credenciales y Computer Use siempre operan sobre esa pestaña enfocada. Cerrar una pestaña libera su `webContents`; cerrar la ventana libera todas.

### Ventanas separadas sin duplicar renderers

Una pestaña puede trasladar su mismo `WebContentsView` desde el `contentView` principal a una `BaseWindow` nativa. La operación no crea otro perfil, no duplica el contenido remoto y no recarga la URL: cookies, historial de navegación en memoria, extensiones y sesión permanecen en el mismo `webContents`. Cerrar la ventana separada reintegra la pestaña al workspace; cerrar la pestaña destruye tanto la ventana contenedora como su contenido.

Se permiten como máximo cuatro ventanas separadas y todas cuentan dentro del límite global de ocho vistas vivas. Las pestañas separadas quedan protegidas de la suspensión LRU mientras su ventana exista. `BaseWindow` evita crear un renderer de aplicación vacío por ventana; solo hospeda la vista remota gobernada. El foco de cada ventana actualiza `activeTabId`, por lo que DOM, captura y Computer Use continúan actuando exclusivamente sobre la superficie enfocada. La ventana principal recupera como activa su pestaña visible al volver a enfocarse.

### Orbe como alternativa al chat lateral

El control `Modo Orbe` invoca la misma ventana Orbe existente mediante `orb:show`, autenticado y restringido al renderer principal. El chat compacto se oculta sin desmontarse y el navegador recupera todo el ancho. La Orbe conserva posición, voz, fuentes y Computer Use existentes; no se crea otro runtime de conversación. Un control persistente en la barra del navegador permite restaurar el chat lateral.

### Densidad compacta del asistente

La barra propia del chat usa 44 px y el compositor compacto una sola línea inicial de 44 px. El placeholder es `Escribe a SofLIA...`, con truncado horizontal y sin salto de línea cuando el panel alcanza su ancho mínimo. El modo normal del chat no cambia.

### Historial JSONL acotado en main

`BrowserHistoryStore` registra solo navegaciones principales HTTP(S) completadas, con UUID, URL sin credenciales, título y timestamp. Ignora `about:blank`, errores, navegación interna y protocolos no permitidos; conserva un máximo de 2.000 entradas y compacta mediante escritura temporal + rename. La consulta acepta texto y límite validado. Borrar historial requiere gesto explícito y no borra cookies.

JSONL evita una migración SQLite para una lista append-heavy pequeña y permite ignorar líneas corruptas. No se reutiliza el historial Chromium porque Electron no ofrece una UI/contrato estable para consultarlo.

### Bóveda por origen con `safeStorage` y autofill por eventos de entrada

`BrowserCredentialVault` guarda metadata en JSON y cada secreto cifrado con la API síncrona de `safeStorage` disponible en Electron 39. Las operaciones se limitan a strings pequeños en main; se migrarán a la API asíncrona cuando la versión tipada del proyecto la incorpore. Falla cerrado si no hay cifrado seguro; en Linux rechaza el backend `basic_text`. El renderer solo recibe id, origen, username y fechas. Guardar/actualizar/eliminar exige una acción de usuario.

El llenado valida que el origen actual HTTPS (o localhost HTTP) coincida exactamente. Main localiza rectángulos de campos mediante un script sin secretos y escribe username/password con foco + `sendInputEvent`/`insertText`; la contraseña no aparece en código inyectado, respuestas IPC, logs ni capturas del modelo. Se descarta captura automática de formularios porque ampliaría de forma innecesaria la exposición del secreto.

### Extensiones administradas y desempaquetadas

El usuario selecciona una carpeta mediante el selector nativo del sistema. `BrowserExtensionManager` valida `manifest.json`, nombre/versión, Manifest V3, número/tamaño de archivos, ausencia de symlinks y permisos declarados. Se rechazan permisos de alto riesgo no soportados por política (`nativeMessaging`, `debugger`, `proxy`, `management`). Main devuelve al renderer solo identidad, permisos, hosts y un token efímero de cinco minutos; el modal SofLIA exige confirmación antes de copiar a `userData/integrated-browser/extensions/<installId>`.

La sesión persistente carga extensiones habilitadas con `session.extensions.loadExtension` cada vez que se inicializa la vista, porque Electron no las recuerda entre ejecuciones. El registro no expone paths al renderer. Deshabilitar descarga la extensión; remover exige confirmación, descarga y elimina solo la carpeta validada dentro del root administrado. No se aceptan `.crx` ni URLs de tienda.

### Contrato IPC segmentado

Se añade un grupo de canales dedicado para historial, bóveda y extensiones. Los handlers reutilizan autenticación/sender del navegador base, validan límites y devuelven respuestas serializables. Las operaciones de secretos y extensiones no se agregan a herramientas del agente. El wrapper renderer ofrece métodos por dominio y la UI usa drawers/modales con estados loading/error/vacío.

### Observación visual obligatoria del navegador visible

Si el navegador integrado está visible, main mantiene una observación reciente de la pestaña enfocada: una captura del `WebContentsView` y un snapshot DOM semántico saneado. El renderer recupera esa evidencia mediante un canal IPC de solo lectura y la adjunta al siguiente turno; no se realizan llamadas al modelo por el simple refresco. Para clics, escritura, scroll o navegación, `use_computer` con `backend: 'browser'` actúa mediante eventos de entrada sobre esa misma vista y recibe el contexto DOM en cada recaptura. Ambas rutas comparten URL, cookies y sesión con el usuario sin capturar el escritorio completo ni abrir un perfil paralelo.

El observador usa una cadencia base de diez segundos y una ventana de calma de cuatro segundos, serializa una sola captura a la vez, descarta estados obsoletos al cambiar de pestaña, URL o revisión visual y conserva únicamente el snapshot más reciente en memoria. El DOM se limita por tamaño, atraviesa shadow roots abiertos, describe iframes sin acceso y omite valores de inputs, textarea, select y contenteditable, campos de contraseña y credenciales embebidas en URL. Un control visible permite pausar/reanudar y al pausar se elimina la evidencia retenida. El contenido observado se etiqueta como no confiable para resistir prompt injection. Las credenciales, historial administrativo y extensiones siguen fuera del catálogo del agente.

Cada turno solicita una observación puntual reciente antes de decidir su ruta. La clasificación distingue lectura de la superficie actual, consulta web y actuación visual: frases como `el repositorio que me mandó Ernesto` quedan ancladas a la pestaña activa aunque no incluyan `mira`, `pantalla` o `página`. El orquestador recibe herramientas deterministas para releer el DOM saneado y navegar el `WebContentsView` a una URL o consulta conocida sin activar Computer Use. Si la evidencia muestra un enlace y el usuario pide analizar su destino, Max/Pro usan primero `web_search` de Responses API y SofLIA/Lite usan Google Search/URL Context; la URL visible del DOM sirve como evidencia de destino. Solo si la lectura remota falla por autenticación, contenido dinámico u otra limitación, o si el usuario solicita clic, escritura, scroll o formularios, se habilita `use_computer` con backend browser sobre la misma sesión. Si la captura puntual falla, el modelo intenta primero `read_browser_dom` y solo escala a Computer Use cuando la observación determinista tampoco puede resolverlo.

### Controles visibles del sidecar

La barra reemplaza abreviaturas por iconos reconocibles con etiquetas accesibles y estados hover/focus. El grip se monta sobre el borde libre del chat flotante, con hit area amplia, pointer capture y teclado. El encabezado completo del chat no se renderiza en este contexto: la tarjeta usa una barra compacta con selector de modelo y razonamiento, pero sin herramientas ni Compartir. Las preferencias se sincronizan entre cualquier selector montado en la misma ventana para que el siguiente turno use inmediatamente el modelo visible. El movimiento cambia el ancho de la tarjeta y republica una sola vez los bounds visibles del navegador. Mover o minimizar el panel no desmonta la conversación.

El mismo encabezado incorpora un acceso compacto a conversaciones. Su popover se superpone dentro del panel, permite filtrar por título, marca el chat activo y ofrece `Nuevo chat` como acción primaria. La lista se limita visualmente y usa scroll interno para no competir con la página; crear o seleccionar conserva abierto el workspace del navegador y reutiliza los handlers canónicos de conversación.

La tercera fila del navegador —título de la página y accesos a historial, contraseñas y extensiones— es plegable y conserva la preferencia local. El botón de restauración permanece en la fila principal, por lo que ocultarla nunca deja al usuario sin salida. La barra de dirección consulta de forma acotada el historial existente, deduplica URLs y ofrece una lista accesible por teclado; seleccionar una sugerencia navega mediante el mismo contrato validado.

El gestor de extensiones incorpora permisos opcionales y hosts opcionales a la inspección previa y conserva un SHA-256 por archivo para rechazar cambios entre inspección y confirmación, incluso si mantienen el tamaño. Los estados instalados muestran permisos y sitios declarados; una carga fallida ofrece reintento explícito sin reinstalar. Los errores serializados hacia el renderer son genéricos y nunca incluyen rutas administradas, mientras el diagnóstico detallado permanece en main.

Las sugerencias de dirección se renderizan como una capa absoluta bajo la barra, con ancho máximo, scroll vertical y z-index propio; no participan en el flujo y por ello no alteran la altura del header, pestañas, favoritos ni viewport. Como el `WebContentsView` se compone por encima del DOM, al aparecer el primer resultado se toma una sola captura puntual y se oculta temporalmente la vista nativa, reutilizando el mismo patrón de los gestores. Mientras la consulta cambia de un conjunto no vacío a otro no se repite la captura. Al seleccionar, pulsar Escape, perder foco o quedar sin resultados se descarta la captura y se republican los mismos bounds sin recargar ni cambiar sesión. Un identificador de generación invalida capturas u ocultaciones tardías para evitar que una respuesta asíncrona vuelva a cubrir o revelar la página en un estado incorrecto. La consulta de main elimina protocolo y `www.` del texto indexable salvo que el usuario escriba explícitamente `://`, evitando que una letra como `s` coincida con todo `https://`.

La misma fila secundaria integra una barra de accesos acotada. Los favoritos son metadata local saneada en `localStorage`, limitada a 24 URLs HTTP(S), y pueden agregarse desde la página actual, abrirse o quitarse. Las extensiones ya gobernadas por main se consultan mediante el IPC existente y aparecen como accesos de estado que abren su gestor; no ejecutan acciones nuevas ni amplían permisos. Ambos grupos usan overflow horizontal sin aumentar permanentemente la altura del header.

### Densidad premium y razonamiento tipo Codex

El panel flotante usa `Inter Tight` para controles, `IBM Plex Sans` para etiquetas y `Newsreader` solo en títulos editoriales. Su ancho predeterminado aumenta sin perder el rango ajustable. El compositor usa una caja de una línea con altura, padding y controles simétricos. El selector de razonamiento deja de ser un grupo de botones segmentados: muestra opciones como filas de menú con descripción, indicador discreto y marca de selección, conservando teclado, roles ARIA y preferencias por modelo.

Los gestores y confirmaciones comparten una superficie sólida, borde translúcido, radio amplio y sombra ambiental contenida; se eliminan gradientes decorativos y tarjetas anidadas que no expresan jerarquía.

### Redirecciones de autenticación sin falsos positivos

La navegación principal mantiene allowlist HTTP(S)/`about:blank` y falla cerrada ante protocolos no permitidos. Los eventos de redirección de subframes se ignoran porque no cambian el destino principal y son habituales en OAuth/2FA. Un error de redirección bloqueada solo se publica para el frame principal y se limpia cuando una carga principal permitida termina correctamente.

`IntegratedBrowserPanel` mide la distancia entre la raíz del navegador y el inicio de su viewport web y la comunica al layout. El chat y el grip usan ese offset más el margen ambiental; por ello empiezan junto a la página y nunca cubren atrás, adelante, dirección o gestores. Se descarta un valor CSS fijo porque el header puede cambiar de altura por ancho, errores o localización.

### Modelo fijo de Computer Use y catálogo conversacional

`src/shared/soflia-runtime-model.ts` define `gemini-3.6-flash` como opción conversacional predeterminada y modelo fijo del actuador Computer Use. El selector conserva SofLIA, SofLIA Max, SofLIA Pro y SofLIA Lite. El ID elegido gobierna siempre el proveedor que orquesta el turno: SofLIA y Lite pasan por Gemini; Max y Pro pasan por OpenAI. Cuando ese orquestador invoca `use_computer`, la herramienta cruza a main y delega únicamente la percepción y actuación a Gemini 3.6 Flash. La selección y el nivel de razonamiento se persisten por modelo para evitar trasladar valores incompatibles entre proveedores.

La búsqueda web y la lectura DOM no pertenecen al actuador. Max/Pro reciben `web_search` alojado con `tool_choice: auto` y las funciones locales `read_browser_dom`/`navigate_integrated_browser`; SofLIA/Lite usan Google Search/URL Context y las mismas funciones locales cuando entran al loop. Las respuestas de DOM omiten la captura base64 y conservan únicamente el snapshot ya saneado y acotado. Este diseño evita consumir presupuesto visual para consultas informativas y mantiene una escalada explícita: DOM -> búsqueda/URL -> navegación determinista -> Computer Use.

El selector no expone un modo “Rápido” o sin razonamiento. Gemini recibe `thinkingConfig.thinkingLevel` con `low`, `medium` o `high`; OpenAI Responses recibe `reasoning.effort` con `low`, `medium`, `high`, `xhigh` o `max`. Preferencias heredadas `minimal` o `none` se migran a `low`. La clasificación de Computer Use habilita el loop de herramientas, pero no sustituye el proveedor conversacional visible. Un timeout o falta de disponibilidad del actuador se reporta: Computer Use no cambia su modelo fijo ni degrada al escritorio o a otro navegador.

Computer Use conserva un tope duro de 120 pasos. El presupuesto general parte de 60 y el navegador integrado recibe un mínimo de 90, suficiente para redirecciones, login y navegación posterior; el loop termina anticipadamente cuando el modelo declara la tarea completa. Si agota el tope, el outcome conserva `presupuesto_agotado` y explica que página, cookies y sesión siguen abiertas para continuar.

### Gestores flotantes y confirmaciones SofLIA

Historial, contraseñas y extensiones se presentan en un único panel flotante de 20–30 rem con radio generoso, borde de 1 px, blur y sombra ambiental según `docs/ux/SOFIA_DESIGN_SYSTEM.md`. El panel usa navegación segmentada interna y no aumenta la altura del header ni reduce permanentemente el viewport.

Como `WebContentsView` se compone por encima del DOM del renderer, el chat no intenta cubrir físicamente la capa nativa: publica un inset izquierdo o derecho y mantiene la vista web viva en el área no obstruida. La observación de main no se usa para componer la página, por lo que evita composición fuera de pantalla y pérdida de interactividad durante Computer Use. Los gestores sí toman una captura puntual y ocultan temporalmente la vista nativa; al cerrarlos se republican los bounds sin recargar. Toda captura de percepción o gestor vive solo en memoria.

Las tareas dirigidas al navegador integrado fallan de forma cerrada si esa vista no puede inicializarse o capturarse. No se reintentan mediante el backend desktop ni abren el navegador predeterminado, porque eso cambiaría silenciosamente de sesión y superficie.

Las operaciones destructivas de historial, credenciales y extensiones dejan de abrir `showMessageBox`: el renderer exige una confirmación accesible con objeto, consecuencia y botones inequívocos antes de invocar el IPC mutador. La instalación de extensiones se divide en selección/inspección y confirmación; main entrega únicamente un token efímero y metadata de permisos, y solo copia/carga después de la confirmación renderer.

### Presupuesto multimedia y orquestación híbrida por superficies

La observación pasiva distingue páginas multimedia de superficies ordinarias. En hosts de vídeo conocidos, la captura periódica se separa al menos treinta segundos y una interacción abre doce segundos de calma para que XHR, render diferido y paneles como transcripciones terminen sin competir con `capturePage`. La inspección explícita conserva disponibilidad inmediata. El renderer solo solicita captura + DOM al iniciar un turno cuando la clasificación detecta referencia o acción sobre el navegador; tener el workspace abierto no convierte todos los mensajes en observaciones forzadas.

El modelo conversacional elegido compone una secuencia de herramientas sin transferir la orquestación. `read_browser_dom` y el controlador determinista operan la pestaña integrada; `use_computer` con `backend: 'browser'` cubre interacción visual compleja en esa misma sesión; `use_computer` con `backend: 'desktop'` observa o actúa sobre aplicaciones externas como Codex. Un plan puede alternar esas superficies de forma explícita, pero un fallo en una de ellas no autoriza cambiar silenciosamente de destino. Antes de enviar mensajes, publicar, pagar o borrar, tanto el controlador DOM como una tarea de Computer Use exigen confirmación humana basada en la intención del paso.

## Risks / Trade-offs

- [Una extensión puede observar páginas y credenciales rellenadas] → advertencia explícita, permisos visibles, denylist de permisos críticos, instalación manual y remoción accesible; no se promete aislamiento entre una extensión aprobada y las páginas que modifica.
- [La bóveda local puede ser descifrada por otro proceso del mismo usuario en Windows] → se documenta el modelo DPAPI; nunca se sincroniza ni expone por IPC en claro.
- [El chat reduce temporalmente el contenido web visible] → ancho acotado, panel movible/redimensionable y minimización inmediata; la vista permanece viva y recupera todo el ancho al minimizar.
- [Historial crece o se corrompe] → límite de 2.000, consultas acotadas, saneamiento y compactación atómica.
- [Una extensión desaparece o deja de ser compatible] → estado `error` visible y resto de extensiones continúa cargando.
- [Autofill elige un campo incorrecto] → solo acción explícita, origen exacto y heurística limitada a campos visibles/editables; error controlado sin revelar el secreto.

## Migration Plan

1. Archivar o integrar primero `add-integrated-agent-browser`; este cambio depende de su servicio y contratos.
2. Introducir stores/servicios y handlers con pruebas, sin activar todavía el nuevo layout.
3. Añadir UI de historial, credenciales y extensiones; migrar la apertura a `isBrowserWorkspaceOpen`.
4. Retirar `ActiveView='browser'` cuando consumidores y pruebas usen el estado ortogonal.
5. Verificar build, suite dirigida y smoke manual. Rollback: desactivar el workspace avanzado y volver a la vista exclusiva; los archivos locales quedan inertes. La remoción de datos requiere acción separada del usuario.

## Open Questions

Ninguna bloqueante. La sincronización entre dispositivos, múltiples perfiles y un catálogo firmado de extensiones requieren cambios posteriores con modelo de identidad y distribución propios.
