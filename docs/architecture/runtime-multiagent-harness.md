# Arnés multiagente de SofLIA

Estado: vigente. Actualizado: 2026-10-11.

<!-- evidence: electron/agent-runtime/service.ts -->
<!-- evidence: electron/agent-runtime/runtime.ts -->
<!-- evidence: electron/codex-runtime/provider.ts -->
<!-- evidence: src/components/meetings/MultiAgentPanel.tsx -->
<!-- evidence: src/shared/agent-runtime.ts -->
<!-- evidence: src/shared/agent-teams/runner.ts -->
<!-- evidence: src/shared/agent-teams/policy.ts -->
<!-- evidence: src/services/gemini-chat/agent-team.ts -->
<!-- evidence: electron/wa-agent/agent-team.ts -->
<!-- evidence: electron/desktop-agent/gemini-cu/client.ts -->
<!-- evidence: electron/presentation-workflow/html-generator.ts -->
<!-- evidence: src/components/agents/AgentActivityPanel.tsx -->
<!-- evidence: src/components/browser/BrowserWorkspaceLayout.tsx -->
<!-- evidence: electron/background-teams/service.ts -->
<!-- evidence: electron/background-teams/handlers.ts -->
<!-- evidence: electron/background-teams/artifacts.ts -->
<!-- evidence: src/shared/background-teams.ts -->

## Equipos ejecutores locales en segundo plano

El chat del Hub puede iniciar trabajos con herramientas reales. Los encargos
explícitos de equipo y las solicitudes afirmativas de documentos, presentaciones,
alternativas independientes o investigación comparativa sustancial admitidas se
enrutan a Electron main. No es necesario mencionar agentes. Las conversiones
aisladas, preguntas explicativas y negativas conservan el flujo directo. Dos especialistas ejecutan
en paralelo y un coordinador espera sus aportes, abre los archivos y crea el
entregable. El turno recibe un identificador y libera el compositor; cambiar de
chat u ocultar el monitor no cancela el trabajo.

La selección usa el encargo humano separado de los adjuntos. Negativas, citas y
modo directo no activan ejecución de fondo. Las Skills activas, imágenes,
PDF, carpetas locales, aplicaciones abiertas, páginas o documentos visibles y
encargos de envío, publicación o acciones críticas conservan el flujo supervisado
existente. El router reutiliza los clasificadores del chat antes de delegar; el
ejecutor de fondo no puede observar esas superficies. No se convierten silenciosamente en tareas que solo
preparen texto ni reciben herramientas nuevas.

Herramientas disponibles: leer contexto, consultar aportes del trabajo, abrir
artefactos propios, búsqueda web hospedada cuando esté autorizada y crear
Markdown, texto, CSV, Word, PowerPoint o Excel. Las carpetas pertenecen al
trabajo/rol; no se admiten rutas arbitrarias, shell, Git, control de pantalla,
correo ni escrituras remotas. Excel genera sumas con fórmula y resultado
calculado en el host sobre columnas numéricas. CSV rechaza prefijos de fórmula,
incluido menos; los números negativos pueden exportarse mediante Excel.

La identidad SOFIA y el propietario Lia se obtienen en main. El contexto incluye
organización validada y generación de sesión. La admisión compara el actor y
organización esperados con el contexto actual; estos campos del renderer son
precondiciones, no autoridad. La guarda se repite antes de herramientas y tras
esperas. Cambiar de sesión u organización interrumpe los trabajos anteriores.

El historial se cifra con safeStorage y se guarda atómicamente. Si falta cifrado,
la modalidad duradera se rechaza. Los archivos entregables son documentos
ordinarios en la carpeta privada de la aplicación; **no están cifrados**.
El estado y los contextos sí. El almacén conserva hasta treinta trabajos;
la ventana muestra activos primero. Los artefactos de trabajos retirados del
historial no se borran automáticamente.

Al reiniciar no se ejecuta trabajo automáticamente: se ofrece reanudar.
Los agentes completados reutilizan archivos cuyo hash siga válido. Los pasos
parciales reciben manifiesto recuperable; repetir una creación idéntica reutiliza
el artefacto por rol, nombre y hash de entrada. Crear contenido distinto conserva
otra versión. No se sobrescriben ediciones posteriores del usuario.
Pausar/cancelar aborta el ejecutor y bloquea acciones tardías; una creación no
confirmada se limpia. No revierte archivos confirmados.

Completar requiere archivos de los dos especialistas y del coordinador.
Los formatos pedidos se comprueban; un informe exige Word salvo petición explícita
de Markdown/texto. Una investigación web exige fuentes observadas por la
herramienta y enlaces presentes en el entregable, incluida la extracción real
de textos de diapositivas. La verificación comprueba integridad, lectura,
estructura, sumas y presencia de referencias; no certifica la veracidad de toda
afirmación ni la calidad visual en Office.

El monitor conserva su ventana flotante y añade operación actual, estado,
consumo, archivos, resultado y controles de pausar/reanudar/cancelar.
Los controles se ejecutan en main por identificadores; el publicador de actividad
anterior no puede inyectar trabajos ejecutables.

Es una ejecución **local**: requiere Soflia Hub abierto, sesión vigente y equipo
disponible. No incorpora host remoto, programación recurrente ni ejecución con
el ordenador apagado. La recuperación conserva el presupuesto restante.
Los proveedores son los modelos permitidos del selector, sin sustitución oculta:
workers con esfuerzo medio y coordinador con la selección del usuario; Gemini
mapea los niveles superiores a HIGH.

Contratos: [background-teams](../../src/shared/background-teams.ts), servicio
[main](../../electron/background-teams/service.ts), [preload](../../electron/preload/background-teams-api.ts)
y [wrapper](../../src/services/background-teams.ts).
Evidencia y evolución: [cambio activo](../../openspec/changes/enable-executable-background-teams/proposal.md).

## Equipos en chat, WhatsApp, navegador y entregables

En las rutas de preparación breve y superficies que conservan el ejecutor del canal,
las solicitudes de documentos, presentaciones y análisis complejos activan dos
especialistas en paralelo. Sus aportes se entregan al coordinador existente,
que conserva las herramientas y realiza las acciones con las guardas de la
superficie. Un saludo o un clic aislado no añade especialistas.

```mermaid
flowchart TD
  A[Solicitud del canal] --> B[Selección y presupuesto del harness]
  B --> C[Especialista de contenido o análisis]
  B --> D[Especialista de estructura o evidencia]
  C --> E[Coordinador existente]
  D --> E
  E --> F[Herramientas del canal y guardas HITL]
  F --> G[Verificación y respuesta o archivo]
  B -->|Modo directo o sin capacidad| E
```

El arnés decide el equipo y gobierna su ejecución; los especialistas aportan
trabajo; el coordinador integra esos aportes. Las guardas de herramientas de
cada canal siguen siendo la autoridad sobre efectos reales. El arnés no les
otorga permisos adicionales a los modelos.

| Solicitud | Especialistas | Quién termina el trabajo |
|---|---|---|
| Crear Word, PDF o informe desde chat o WhatsApp | Contenido y estructura | El agente del canal usa sus herramientas de archivos |
| Crear presentación desde chat o flujo WhatsApp | Contenido y diseño | La Skill/generador existente valida y materializa deck.json |
| Revisar una página desde chat/navegador | Análisis de página y evidencia | El chat integra el DOM o extractos ya autorizados |
| Computer Use con varios pasos | Plan y verificación | Un solo controlador conserva capturas, acciones y aprobaciones |
| Análisis complejo general | Análisis y evidencia | El modelo conversacional seleccionado |

El chat completo, orbe y chat del navegador comparten el pipeline. Los equipos
usan el mismo proveedor/modelo resuelto para ese turno: Gemini u OpenAI en chat,
`gpt-6-luna` mediante OpenAI Responses en WhatsApp y sus presentaciones;
Gemini en Computer Use. El adaptador Codex sigue siendo exclusivo
del panel de reuniones. No se transfieren las sesiones personales de Codex.

Ejemplos que se pueden escribir directamente:

- `Revisa esta página y señala problemas de claridad y datos sin respaldo.`
- `Crea un informe ejecutivo con estos resultados: ...`
- `Crea una presentación de seis diapositivas con esta información: ...`
- `modo equipo: compara estas dos propuestas y señala sus supuestos: ...`
- `usa los multiagentes para que cada uno proponga algo diferente`
- `modo directo: redacta un informe breve con estos datos: ...`

Los prefijos `modo equipo:` y `modo directo:` se reconocen al inicio del pedido.
También se reconocen pedidos afirmativos de usar multiagentes o varios agentes.
Una pregunta informativa o una frase citada no fuerza el equipo. `No uses los
multiagentes`, `sin multiagentes` y modo directo omiten los especialistas. Al pedir
ideas o propuestas alternativas en modo equipo, los dos roles de análisis usan
perspectivas práctica y creativa.
En el flujo dedicado de presentaciones de WhatsApp se pueden indicar al aportar
los datos o al aprobar: `modo directo: si`. La selección permanece para esa
presentación. Son controles por solicitud, no una preferencia persistente de
cuenta. Un Computer Use delegado tiene su propia fase y selección; el prefijo
del chat no se propaga como un permiso o ajuste global a otras herramientas.

Los especialistas de página sólo reciben el texto del turno, DOM, documento
activo o extractos que el chat ya obtuvo bajo sus reglas. En modo de extractos
no adquieren búsqueda, navegación ni acceso a otras pestañas. Los especialistas
de Computer Use reciben contexto semántico cuando existe; la captura visual
permanece en el controlador. No afirman haber inspeccionado imágenes no recibidas.

Los especialistas de chat reciben hasta seis mensajes recientes del mismo chat,
con ocho mil caracteres repartidos entre los mensajes y marcador de truncamiento.
El historial se etiqueta como dato no confiable; ayuda a resolver seguimientos
como «cada uno proponga algo diferente», sin sustituir las fuentes autoritativas.
Los especialistas no disponen de herramientas, memoria compartida ni historial
de otros chats. Preparan aportes; no abren páginas por su cuenta, no escriben
archivos en paralelo y no ejecutan acciones. El coordinador debe obtener las
fuentes faltantes y verificar el resultado real. Un borrador de especialista
no demuestra que un documento exista ni autoriza enviar, pagar o borrar.

El chat muestra `Especialistas trabajando en equipo...` mediante el canal de
actividad existente; los eventos incluyen tipo, estado, duración y número de
aportes completos, sin contenido. Main registra los mismos metadatos. No hay
un panel persistente ni reanudación de estos equipos: los aportes son efímeros.

### Límites y rendimiento de equipos generales

La fuente es [TEAM_LIMITS](../../src/shared/agent-teams/policy.ts): dos workers
por equipo, cuatro peticiones de especialistas pendientes por proceso, quince segundos por
equipo, 4000 caracteres de solicitud, 24000 de fuente, 1500 tokens solicitados
y 6000 caracteres conservados por aporte. El límite de concurrencia no es
global entre main y renderer. Los datos truncados se etiquetan para el worker;
el coordinador conserva el contexto original de su ruta.

Si no hay cupo se continúa con un coordinador, sin cola. Si falla un especialista,
se aprovecha el otro; si fallan ambos, se mantiene el flujo normal. Cancelar
descarta resultados tardíos. Si un proveedor ignora abort, su cupo permanece
ocupado hasta que termine realmente; no se lanza otra petición para sustituirlo.
El coordinador recibe siempre el estado real del intento de equipo, aunque no
haya aportes, para describir fallos o falta de cupo sin atribuir trabajo ficticio.

Los workers añaden hasta dos llamadas por fase. El consumo Max se reserva una
vez antes de su primera llamada y sus tokens reportados se contabilizan. No
se hereda el razonamiento alto del coordinador: los especialistas usan nivel
`low` en ambos proveedores para conservar texto útil dentro de sus 1500 tokens.
El coordinador conserva el modelo y nivel elegidos por el usuario. No
se promete ahorro monetario. Una tarea de chat que después delega a Computer Use
puede preparar otro equipo en esa segunda fase. El paralelismo de los workers
está probado; una mejora real de rapidez o calidad frente al flujo directo
requiere evaluación con los modelos y documentos del usuario.

Las presentaciones dedicadas conservan su aprobación y exportación existentes.
Cancelar detiene etapas posteriores y evita iniciar el envío; una operación
local o envío ya iniciado no se revierte automáticamente.

## Uso en Meeting Ops

En Meeting Ops, escribe título y transcripción en el formulario y usa **Análisis en equipo**.
El especialista de acuerdos y el de evidencia trabajan en paralelo; después,
el coordinador prepara una minuta. El panel muestra aportes, estados, tokens
observados y consultas. La fuente se entrega como datos a cada etapa mediante
el mismo dispatcher autorizado que atiende herramientas adicionales.

Gemini utiliza la clave existente de SofLIA y su modelo runtime. Para Codex,
abre Configurar Codex, selecciona su ejecutable nativo y guarda una clave API
OpenAI del contexto actual. La clave nunca se devuelve al renderer. La
configuración se conserva cifrada cuando el sistema permite hacerlo.
No se reutiliza la sesión personal de la aplicación Codex ni se copia auth.json.
La selección del ejecutable y el handshake se validan; la ejecución de modelos
requiere una cuenta y un modelo accesibles.

Revisa la minuta y marca la confirmación antes de **Crear borrador revisable**.
La autorización dura diez minutos y se liga al digest del resultado. El
pipeline existente procesa ese borrador y conserva sus revisiones/aprobaciones
antes de sincronizar acciones. Esta operación no equivale a enviar correos o
crear tareas aprobadas. Actualiza la lista de Meeting Ops para consultar el
borrador y su revisión.

## Arquitectura y alcance

[Orquestador](../../electron/agent-runtime/service.ts) → proveedor
[Gemini](../../electron/agent-runtime/gemini-provider.ts) o
[Codex](../../electron/codex-runtime/provider.ts) → catálogo cerrado de
[herramientas](../../electron/agent-runtime/tools.ts).

El equipo tiene un grafo fijo, sin delegación recursiva: acuerdos y evidencia,
seguidos de coordinador. El host controla la concurrencia. Esta implementación
usa threads independientes del app-server; no habilita las herramientas nativas
de spawn de Codex. Los roles son una estrategia de meeting-agent, no identidades
con permisos adicionales dentro de MCPManager.

Las herramientas permitidas son leer_transcripcion, buscar_evidencia y,
solo para el coordinador, leer_aportes. Ninguna realiza efectos externos. No
se cargan skills de desarrollo, Git, shell, plugins personales ni herramientas
arbitrarias del MCPManager. El dispatcher comparte validación y presupuesto
entre proveedores. No hay servidor MCP de SofLIA abierto en red.

Codex usa JSON por líneas a través de stdio, hogar por usuario/organización,
variables mínimas y credencial efímera dentro del proceso. Antes de enviar el
turno, se exige environments vacío, ausencia de instrucciones externas y un
inventario MCP vacío. Las herramientas dinámicas y selectedCapabilityRoots
requieren soporte experimental: una incompatibilidad termina la conexión.
Cada especialista usa su propio proceso; al cancelar se cierra ese proceso
aislado. No se conserva un turno de Codex para reanudarlo después.

La integración consume el binario instalado; no redistribuye código ni binarios
de Codex. La licencia raíz del repositorio investigado es Apache-2.0. Una futura
distribución debe revisar también NOTICE y licencias de componentes incluidos;
esta entrega no empaqueta bubblewrap ni otro componente de terceros.

## Identidad, permisos y efectos

La sesión SOFIA validada por main fija el propietario del arnés. Una organización
seleccionada requiere membresía activa en organization_users. El renderer no
puede suministrar userId, catálogo, RPC, rutas de trabajo ni políticas arbitrarias.

La creación del borrador utiliza el identificador de la sesión Lia, que puede
diferir del de SOFIA. Se comprueban ambas identidades entre etapas del pipeline.
Si cambia la sesión se detienen operaciones posteriores. Un efecto ya iniciado
puede haberse completado: se conserva estado incierto en vez de reintentarlo.

Los handlers verifican ventana principal, frame principal, payload y contexto.
Cambiar contexto, cerrar sesión o salir del panel cancela el análisis y retira
confirmaciones. La minuta no concede autoridad por contener instrucciones.

## Persistencia y recuperación

El [repositorio](../../electron/agent-runtime/repository.ts) guarda snapshots
cifrados con safeStorage, por hash de usuario/organización, bajo
userData/agent-runtime/runs. Valida el esquema al leer, escribe mediante reemplazo
atómico y conserva veinte ejecuciones por ámbito. Sin cifrado seguro, trabaja
en memoria y lo indica en el panel; no degrada a texto claro.

Al abrir un ámbito, ejecuciones que estaban activas o pendientes de revisión se
muestran interrumpidas, con sus aprobaciones retiradas. Recuperar crea una nueva
ejecución de lectura ligada a la anterior. Una publicación pendiente al reiniciar
se vuelve incierta y no se repite automáticamente.

Si aparece **Comprueba el resultado en Meeting Ops**, revisa la lista antes de
crear otra operación. No se promete entrega exactamente una vez entre sistemas;
el servicio Meeting Ops conserva además su deduplicación por fuente, propietario
y comprobación de organización antes de reutilizar una ejecución.

La retención local del arnés no elimina los borradores ya guardados en Meeting
Ops ni gestiona la retención del proveedor. No hay sincronización del historial
del arnés entre dispositivos.

## Límites y verificación

La fuente de parámetros es [AGENT_LIMITS](../../src/shared/agent-runtime.ts):
80000 caracteres de fuente, 24000 por salida, doce consultas por etapa, seis
llamadas por etapa Gemini, 3000 tokens de salida solicitados por llamada Gemini,
tres minutos por análisis y treinta segundos por solicitud RPC.
Codex se corta por duración, herramientas y uso observado; no se garantiza un
tope monetario ni un número exacto de iteraciones internas del motor.

Las citas de líneas facilitan revisión humana; no prueban por sí solas que la
interpretación del modelo sea correcta. La integración no acredita una mejora
de calidad o costo frente a un agente único sin evaluación con datos reales.

Ver [evidencia del cambio](../../openspec/changes/integrate-multiagent-harness/reports/verification.md).
El test codex-runtime-native es opt-in mediante SOFLIA_CODEX_TEST_EXECUTABLE y
comprueba el handshake sin inferencia. Las pruebas de proveedores usan procesos
simulados para comprobar fallos, herramientas prohibidas y cancelación.

## Monitor de equipos

Cuando comienza un equipo nuevo, el Hub despliega la ventana flotante «Equipo de
SofLIA» dentro de la propia ventana, sin abrir ventanas adicionales. En el chat
se superpone a la derecha sin reducir el ancho del canvas, con borde redondeado,
altura acotada y estado vacío compacto. Su superficie azul oscura usa tokens
del tema; el tema claro conserva su superficie clara. En el navegador integrado se coloca bajo la
barra de pestañas, en el borde derecho, y su ancho se descuenta de la vista
nativa de la página (que se compone por encima del DOM y lo taparía). Si el chat
flotante también está a la derecha, se coloca a su lado.

El botón «Ver archivos de SofLIA» vive dentro de la barra de título del Hub y de
la barra de pestañas del navegador, junto a sus demás controles, y marca con un
punto los equipos en curso. Ocultar el panel o plegar un equipo no cancela la
tarea, y las actualizaciones del mismo equipo no lo vuelven a abrir. El estado
del panel lo mantiene un único proveedor React con una sola suscripción. Main
conserva los últimos doce equipos en memoria; cerrar sesión o cambiar de usuario
borra este estado.

Las actividades de tipo `computer` sin artefactos no abren el panel ni aparecen
en su lista: el control de pantalla conserva sus eventos en el monitor runtime.
Si esa actividad aporta archivos reales, el panel permite acceder a ellos.
Los trabajos de documentos y presentaciones conservan su comportamiento.

El panel flotante muestra archivos agrupados por encargo y un estado global,
sin roles, operaciones ni contadores por agente. Los nombres de archivo pueden
ocupar varias líneas. El chat muestra la síntesis de SofLIA y los mismos archivos;
los registros técnicos se conservan en el runtime. Ambos paneles de archivos y
visor admiten ajuste de ancho con puntero o teclado. En el navegador integrado,
el ancho real actualiza los insets de la vista nativa para evitar superposición.

El publicador entrega los eventos reales del propio chat a la suscripción local
antes de esperar IPC. El servicio combina snapshot inicial, eventos main y
progreso local por ID/secuencia, prioriza equipos activos y conserva hasta doce.
No fabrica especialistas ni expone el contenido de sus aportes. Cada suscripción
local se liga a la identidad SOFIA activa; cambiarla retira listeners, actividad
y errores anteriores. Un rechazo IPC se presenta como indisponibilidad del
monitor compartido mientras el progreso local observado sigue visible. Main
conserva sus guardas y sigue siendo la fuente de otras superficies. Los snapshots
atrasados no reemplazan eventos main más recientes ni revierten el progreso local.

Los eventos de [runner](../../src/shared/agent-teams/runner.ts) cubren Chat del
Hub, Orbe, WhatsApp, preparación del navegador, Computer Use, documentos y
presentaciones cuando esas rutas activan equipos. Meeting Ops proyecta sus
etapas desde el arnés existente. El publicador renderer se limita a los frames
principales de las ventanas actuales de Hub y Orbe, comprobados en main. La Orbe
captura el usuario al iniciar el turno y cancela/limpia su conversación cuando
cambia de propietario. Main determina la etiqueta Chat/Orbe y separa sus IDs;
una superficie no puede sobrescribir el equipo de otra aunque repita el UUID.
El modo directo no abre un equipo.

[Main](../../electron/agent-activity/index.ts) valida esquemas cerrados,
identidad y secuencias; ignora eventos atrasados y cierra los equipos de reuniones
que desaparecen al cambiar de contexto. Sólo difunde `agent-activity:changed`
a la ventana del Hub y expone dos canales invocables, `agent-activity:snapshot`
y `agent-activity:publish`, restringidos a los frames principales de Hub y Orbe.
Main no abre ni controla vistas: mostrar u ocultar el panel es estado del
renderer. Los errores de observación no deben interrumpir el trabajo, y el panel
no puede ejecutar herramientas.
El chat transmite `activityOwnerId` desde la identidad SOFIA del contexto de
autenticación; el propietario Lia de memoria y datos conserva su alcance.
Main sigue comprobando la identidad SOFIA y rechaza publicadores de otro usuario.

## Retirada

Retirar el panel y initializeAgentRuntime desactiva esta capacidad. No requiere
migraciones. Los borradores creados permanecen en Meeting Ops y siguen sus
políticas de retención. Las rutas de datos locales y las credenciales guardadas
se gestionan aparte; no se borran implícitamente al quitar la interfaz.
