## MODIFIED Requirements

### Requirement: Rendimiento y compatibilidad de páginas dinámicas
El navegador SHALL conservar compatibilidad Chromium para aplicaciones web modernas y MUST evitar que la percepción pasiva bloquee el renderer remoto.

#### Scenario: Percepción pasiva durante contenido dinámico
- **WHEN** una página visible actualiza contenido multimedia, transcripciones o paneles asíncronos sin intervención del agente
- **THEN** el sistema toma una captura visual acotada sin ejecutar un recorrido DOM completo y espera al menos diez segundos antes de repetirla

#### Scenario: Panel multimedia tras una interacción
- **WHEN** el usuario abre una transcripción u otro panel asíncrono en una superficie multimedia conocida
- **THEN** la observación pasiva espera al menos doce segundos de calma y separa sus capturas al menos treinta segundos, mientras la captura o lectura solicitada explícitamente continúa disponible

#### Scenario: Turno no relacionado con el navegador
- **WHEN** el navegador permanece visible pero el mensaje no se refiere a su contenido ni solicita una acción web
- **THEN** el renderer no fuerza captura ni recorrido DOM para ese turno y el navegador conserva su presupuesto para la página

#### Scenario: Interacción y panel asíncrono en curso
- **WHEN** el usuario hace clic, escribe, desplaza o cambia una vista mientras la página resuelve contenido dinámico
- **THEN** el sistema difiere y deduplica la captura pasiva hasta una ventana de calma, no compite con Computer Use y conserva una captura explícita bajo demanda

#### Scenario: Evidencia visual acotada
- **WHEN** el viewport visible supera el presupuesto visual de percepción pasiva
- **THEN** main reduce una copia de la imagen a un máximo de 1024 px en su lado mayor antes de codificarla, conserva la relación de aspecto y mantiene en resolución completa las capturas renderer solicitadas explícitamente

#### Scenario: Turno que requiere comprensión de la página
- **WHEN** SofLIA necesita inspeccionar la pestaña activa
- **THEN** el sistema reutiliza una captura visual reciente, obtiene un DOM saneado bajo demanda con límites de nodos y viewport, y conserva URL, sesión y pestaña

#### Scenario: Compatibilidad sin ampliar privilegios
- **WHEN** una página adapta capacidades según User-Agent
- **THEN** la vista y su sesión anuncian Chromium sin el nombre del producto ni el token Electron, incluidos subframes cruzados y workers, y conservan `sandbox`, `contextIsolation`, `webSecurity`, bloqueo de contenido inseguro y throttling de fondo

#### Scenario: Google Meet abierto desde Gmail o Chat
- **WHEN** una reunión estándar de Meet nace en una ventana `about:blank` y luego publica un destino distinto de `/call`
- **THEN** main crea y registra la ventana hija antes de entregarla a Chromium y no concede captura sin origen HTTP(S), decisión por sitio, aprobación del usuario y permiso del sistema operativo

#### Scenario: Llamada directa nativa desde Google Chat
- **WHEN** Gmail o Chat abre, navega o crea un subframe con el destino HTTPS exacto `meet.google.com/call` como parte de una llamada directa
- **THEN** main cancela esa apertura o navegación sin crear pestaña, ventana, reunión alternativa, navegador externo ni telemetría específica de invitación; la regla cubre un destino conocido, la transición `about:blank -> /call`, ventanas anidadas, redirecciones y subframes

#### Scenario: Runtime Chromium compatible y verificable
- **WHEN** la llamada directa inicia desde Gmail o Chat
- **THEN** el runtime no aplica field trials, reescritura SDP, observación RPC ni lógica de compatibilidad de Meet; la identidad Chromium y los permisos generales del navegador permanecen como capacidades independientes

#### Scenario: La aplicación no fabrica llamadas
- **WHEN** Gmail o Chat emite una señal directa o automática de llamada
- **THEN** SofLIA no crea una reunión, no navega a `meet.google.com/new` ni a `/call`, no ejecuta sondas sobre el control y no abre una pestaña o ventana por temporizador, restauración o heurística propia

#### Scenario: Contenido externo a la ventana gobernada
- **WHEN** otro `webContents` no registrado consulta o solicita cámara o micrófono
- **THEN** el sistema lo rechaza aunque use un origen HTTP(S), sin mostrar un aviso ni ampliar la confianza a toda la sesión

#### Scenario: Consulta desde iframe cruzado de Meet
- **WHEN** Electron entrega `webContents = null` para una consulta de `media` desde un iframe HTTP(S) de Meet embebido en Gmail
- **THEN** el sistema valida `embeddingOrigin` y el origen solicitante de la sesión aislada y permite únicamente la consulta; la solicitud real conserva `webContents` registrado, origen HTTP(S), decisión por sitio, HITL y permiso del sistema

#### Scenario: Preflight de media sin identidad ni origen
- **WHEN** Electron entrega una consulta previa de `media` con `webContents` nulo o ausente y sin `requestingOrigin`, `securityOrigin`, `requestingUrl` ni `embeddingOrigin` dentro de la sesión aislada del navegador
- **THEN** el sistema permite únicamente esa consulta para que el sitio llegue a `getUserMedia`; cualquier solicitud real sigue exigiendo `webContents` registrado, origen HTTP(S), decisión por sitio, HITL y permiso del sistema, y un origen explícito no HTTP(S) continúa denegado

#### Scenario: Sincronización de fondo de la llamada
- **WHEN** Gmail, Chat o Meet consulta `background-sync` desde contenido gobernado o un iframe HTTP(S) embebido
- **THEN** el navegador responde afirmativamente sin aviso porque no concede dispositivos ni APIs privilegiadas de Electron, conserva operativo el service worker y mantiene su tráfico sujeto al origen y a la sesión aislada

### Requirement: Vista de navegador integrada
El sistema SHALL ofrecer a cada usuario autenticado un navegador dentro de un panel derecho del workspace de SofLIA con barra de dirección, atrás, adelante, recarga o detención, foco y estado de carga/error, sin reemplazar la única instancia del chat activo salvo cuando el usuario lo expanda a ancho completo.

#### Scenario: Navegación manual exitosa
- **WHEN** el usuario abre Navegador e introduce una URL HTTP(S) válida
- **THEN** el sistema muestra el sitio en el panel derecho y actualiza URL, título, carga e historial mientras el chat permanece disponible

#### Scenario: Búsqueda desde la barra
- **WHEN** el usuario introduce texto que no es una URL
- **THEN** el sistema navega a una búsqueda HTTPS con el texto codificado

#### Scenario: Error de navegación
- **WHEN** la carga principal falla
- **THEN** la barra conserva un estado observable con mensaje seguro y permite reintentar o navegar a otra dirección

#### Scenario: Navegador a ancho completo
- **WHEN** el usuario expande el panel hasta el máximo
- **THEN** el navegador ocupa el área del chat y puede reducirse de nuevo sin perder la página o conversación

### Requirement: Percepción y control del navegador por el agente de chat
El agente de chat SHALL inspeccionar y operar el mismo `WebContentsView` visible cuando el usuario se refiera a la página actual o solicite una acción dentro de ella.

#### Scenario: Pregunta sobre lo visible
- **WHEN** el navegador está abierto y el usuario pregunta qué ve, si puede ver lo mostrado o pide observar la página
- **THEN** el sistema captura la vista integrada mediante el canal de solo lectura, la adjunta al turno multimodal antes de responder y describe evidencia de la página actual

#### Scenario: Interacción solicitada
- **WHEN** el usuario pide hacer clic, escribir, desplazarse o navegar dentro de la página visible
- **THEN** Computer Use actúa sobre la misma vista y sesión, verifica el resultado y no afirma éxito sin outcome completado

#### Scenario: Navegador no visible
- **WHEN** el usuario formula una referencia visual pero no existe un viewport integrado visible
- **THEN** el sistema no inventa contenido y usa la herramienta visual adecuada o explica que necesita abrir la superficie

#### Scenario: Dos pestañas visibles
- **WHEN** hay dos pestañas visibles y el usuario enfoca una de ellas antes de pedir observación o interacción
- **THEN** el agente captura y controla exclusivamente la pestaña enfocada y el estado de la barra la identifica

#### Scenario: Referencia contextual sin verbo visual
- **WHEN** el navegador está abierto y el usuario se refiere a un mensaje, persona o recurso mostrado con una frase como `el repositorio que me mandó Ernesto`
- **THEN** el sistema adjunta una observación puntual de la pestaña activa y resuelve la referencia desde esa evidencia sin pedir que el usuario vuelva a copiar lo visible

#### Scenario: Contenido detrás de un enlace visible
- **WHEN** la observación permite identificar un enlace pero el usuario solicita resumir o analizar el recurso de destino
- **THEN** el agente usa primero búsqueda web o URL Context con la URL saneada del DOM y puede navegar determinísticamente la misma sesión; solo escala a Computer Use si la lectura requiere interacción visual o acceso autenticado no resoluble por esas rutas

#### Scenario: Lectura DOM sin Computer Use
- **WHEN** el texto, estructura o enlace requerido está disponible en el snapshot DOM saneado de la pestaña activa
- **THEN** el modelo seleccionado responde o relee el DOM mediante `read_browser_dom` sin iniciar el actuador visual

#### Scenario: Búsqueda web con modelo OpenAI
- **WHEN** SofLIA Max o Pro está seleccionado y la solicitud requiere información pública actualizada o ampliar un recurso visible
- **THEN** el mismo modelo usa `web_search` de Responses API con elección automática, conserva su razonamiento y no invoca Computer Use salvo que después necesite interactuar con la página

#### Scenario: Navegación determinista
- **WHEN** el usuario solicita abrir una URL o recurso conocido sin clics, escritura, scroll ni formularios
- **THEN** el orquestador usa `navigate_integrated_browser`, espera la carga y recibe el DOM saneado de la misma sesión sin delegar en Gemini Computer Use

#### Scenario: Flujo híbrido entre Codex y Google Chat
- **WHEN** el usuario pide observar una aplicación de escritorio, elaborar un resumen y llevarlo a una sesión de Google Chat abierta en el navegador integrado
- **THEN** el modelo seleccionado conserva la orquestación, usa Computer Use con superficie desktop solo para la evidencia externa, vuelve al DOM o Computer Use browser para la pestaña integrada y solicita confirmación antes del envío

#### Scenario: Fallo de una superficie en un plan híbrido
- **WHEN** un paso declarado para desktop o navegador integrado falla o no puede verificarse
- **THEN** el sistema reporta el estado real y no cambia silenciosamente de superficie ni afirma que el siguiente paso fue completado

### Requirement: Percepción continua visual y semántica gobernada
El sistema SHALL mantener en memoria una observación reciente de la pestaña activa y visible que combine captura visual y DOM semántico saneado, SHALL refrescarla con frecuencia acotada sin invocar al modelo por sí sola y MUST permitir al usuario pausarla explícitamente.

#### Scenario: El usuario navega mientras la percepción está activa
- **WHEN** cambia el contenido de la pestaña activa y el navegador integrado permanece visible
- **THEN** main actualiza como máximo una observación a la vez, conserva únicamente la más reciente y el siguiente turno de chat o paso de Computer Use recibe esa evidencia

#### Scenario: El DOM contiene formularios o secretos
- **WHEN** main construye el contexto semántico de una página con inputs, textarea, select, contenteditable o campos de contraseña
- **THEN** incluye etiquetas, roles, estructura, texto público y geometría útil, pero omite valores escritos, contraseñas, contenido editable y credenciales de URL

#### Scenario: El usuario pausa la percepción
- **WHEN** el usuario activa el control de pausa visible en el navegador
- **THEN** se detiene el refresco, se descarta la observación visual almacenada y SofLIA no afirma conocer cambios posteriores hasta que el usuario la reactive

#### Scenario: El contenido de la página intenta instruir al agente
- **WHEN** texto o atributos del DOM contienen órdenes, prompts o instrucciones para SofLIA
- **THEN** el sistema los marca como datos no confiables de la página y no los trata como instrucciones de sistema ni autorización de acciones

### Requirement: Modelo fijo de Computer Use y catálogo conversacional
El sistema SHALL usar `gemini-3.6-flash` como modelo fijo de Computer Use de SofLIA y MUST conservar el catálogo conversacional disponible para selección del usuario. Computer Use MUST NOT degradar silenciosamente a `gemini-2.5-pro`, modelos Flash anteriores ni modelos de otro proveedor.

#### Scenario: Acción de computadora con otro modelo seleccionado
- **WHEN** el usuario seleccionó SofLIA Max, SofLIA Pro o SofLIA Lite y solicita una acción de Computer Use
- **THEN** el modelo seleccionado conserva la orquestación y su razonamiento, mientras la llamada interna a `use_computer` delega exclusivamente la percepción y actuación a `gemini-3.6-flash`

#### Scenario: Selección conversacional
- **WHEN** el usuario abre el selector o envía un turno normal sin Computer Use
- **THEN** ve SofLIA, SofLIA Max, SofLIA Pro y SofLIA Lite, y el runtime despacha SofLIA/Lite a Gemini y Max/Pro a OpenAI según la selección y cuota

#### Scenario: Razonamiento compatible y persistente
- **WHEN** el usuario cambia el nivel de razonamiento de un modelo y alterna entre modelos o reinicia la interfaz
- **THEN** cada modelo recupera su propia preferencia válida; el selector no muestra “Rápido”, Gemini recibe `low`, `medium` o `high` y OpenAI recibe `low`, `medium`, `high`, `xhigh` o `max`

#### Scenario: Preferencia rápida heredada
- **WHEN** existe una preferencia antigua `minimal` o `none`
- **THEN** la interfaz selecciona `low`, no muestra “Rápido” y el runtime no envía un turno sin razonamiento

#### Scenario: Computer Use con esfuerzo exclusivo de OpenAI
- **WHEN** el usuario seleccionó Max o Pro con esfuerzo `xhigh` o `max` y solicita una acción de Computer Use
- **THEN** el pipeline OpenAI conserva ese esfuerzo para planear y responder, y el actuador Gemini recibe su propia configuración fija sin trasladar ni degradar el razonamiento conversacional

#### Scenario: Herramientas de lectura independientes del actuador
- **WHEN** el modelo seleccionado solo necesita buscar en la web, inspeccionar el DOM o navegar a un destino directo
- **THEN** esas herramientas se ejecutan en el proveedor orquestador o mediante el wrapper tipado existente y `gemini-3.6-flash` no recibe una tarea de Computer Use

#### Scenario: Tarea de Computer Use con efecto externo
- **WHEN** una instrucción de Computer Use pretende enviar, publicar, pagar, borrar o confirmar una acción irreversible
- **THEN** el runtime solicita confirmación humana antes de iniciar ese paso, incluso si la tarea combina lectura DOM y otras acciones permitidas
