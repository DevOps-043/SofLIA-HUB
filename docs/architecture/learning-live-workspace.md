# Aula de sesiones de Learning

Estado: implementación local para pruebas; despliegue pendiente. Actualizado: 2026-10-12.

<!-- evidence: src/components/learning-live/LearningWorkspace.tsx -->
<!-- evidence: src/components/learning-live/ConnectedStudio.tsx -->
<!-- evidence: electron/learning-studio-access.ts -->
<!-- evidence: electron/learning-studio-realtime.ts -->
<!-- evidence: src/shared/live-studio.contract.ts -->
<!-- evidence: src/shared/live-studio-domain.ts -->
<!-- evidence: packages/zoom-runtime/runtime.ts -->

La entrada Sesiones síncronas, debajo de Navegador y Reuniones, abre la agenda de la organización activa. Learning verifica bearer y asignación académica. Seleccionar una sesión sustituye navegador, conversaciones y agentes por un aula React; no abre automáticamente medios ni pestañas externas. Volver o salir regresan a la agenda.

`ConnectedStudio` consulta el snapshot del estudio y selecciona Instructor o Participante exclusivamente con el `can_manage` de Learning. La primera vista conserva chat y estadísticas a la izquierda, escenario y escenas al centro, herramientas a la derecha y barra de medios compacta. La segunda recibe contenido, chat permitido, materiales, quiz publicado y prácticas. El selector de rol existe solo en las fixtures de prueba.

El panel usa Conectar sesión para el instructor y Unirme a la sesión para el
participante. Las etiquetas, ayudas y errores propios de Hub no nombran al
proveedor audiovisual ni muestran el estado técnico de Realtime. La suscripción
y la recuperación de snapshots se conservan. El runtime aislado selecciona Meeting
o Video SDK según el grant de Learning; las sesiones anteriores siguen con Meeting.
Video ofrece controles de audio, cámara y pantalla en español y recursos locales
versionados. El aula no muestra el bloque informativo de grabación automática; la preferencia
de disponibilidad posterior se administra exclusivamente en Learning.

## Estado y autorización

Learning es dueño del estado académico; Hub no escribe contenido directamente en Supabase. La API `POST /api/auth/live/studio` valida cuerpo estricto de 32 KiB, bearer, organización y curso. Los comandos académicos identifican operación con UUID y revisión; una transacción serializa la sesión, revalida autorización y deduplica por actor/comando. El chat, actividades y permisos requieren confirmación del servidor. Las escenas de producción y sus vínculos se preparan localmente y no dependen de esa confirmación.

Realtime suscribe INSERT/UPDATE de `live_studio_revisions` con RLS académico. Solo circulan sesión, revisión y fecha; mensajes, respuestas, entregas y tokens nunca se publican. Cada invalidación recupera un snapshot autorizado; lecturas concurrentes se agrupan y respuestas tardías se descartan. Reconexión fuerza lectura. La presencia renueva un lease de 90 segundos cada 30; SQL fusiona solo el miembro actual y no publica revisión por latidos sin cambios visibles. No se ha ensayado capacidad de 500 usuarios; ese número es un límite defensivo del contrato.

El instructor puede publicar mensajes, cerrar/abrir chat, habilitar el acceso al botón de reacciones, restringir escritura, bloquear y restablecer acceso académico. El bloqueo no expulsa a un usuario ya conectado en Zoom; Zoom conserva su propia moderación audiovisual. Las estadísticas abarcan los últimos 100 mensajes retenidos, no un historial completo. Las reacciones son eventos independientes que flotan cinco segundos sobre el video; no crean mensajes. El instructor puede configurar de 0 a 300 segundos de espera entre mensajes de participantes (0 desactiva), con validación transaccional en Learning. Interacciones automáticas de SofLIA quedan deshabilitadas hasta integrar política y consentimiento.

Los participantes reciben sus entregas y respuestas, sin claves de quiz, respuestas ajenas ni conversaciones de otras salas. Las salas académicas distribuyen identidades realmente conectadas por tamaño o cantidad; se puede visitar su chat y regresar al principal. Las salas de audio se administran en Zoom: todavía no existe correlación segura de identidad académica con participante Zoom ni sincronización automática de salas.

## Preparación, materiales y reloj

El dominio valida escenas, material, prácticas y quizzes. Archivos privados de hasta 25 MB se suben por URL firmada; el servidor comprueba pertenencia de ruta, existencia, tamaño y MIME antes de publicarlos. Lecturas usan el mismo flujo. Crear o importar un quiz JSON no lo publica hasta que el instructor lo indique. Entregas y reloj se guardan en Learning; el reloj se representa a partir de hora de servidor sin escribir cada segundo.

El manifiesto Engine versión 1 incluye curso, revisión y bancos de escenas/materiales/quizzes/prácticas. La importación valida el curso y aplica una preparación completa. Sus rutas de archivos ya deben pertenecer al bucket de esa sesión. El checkout Engine todavía no tiene un publicador síncrono: esta fase ofrece importación validada, no entrega automática entre plataformas. Es un contrato de preparación nuevo, no el manifiesto audiovisual `film.json`.

El banco del instructor contiene escenas locales: láminas, fuentes de pantalla, imágenes y videos. Crear, seleccionar y quitar no envía comandos ni archivos a Learning. El contenido del manifiesto puede servir como preparación inicial; el participante conserva el contenido académico publicado y recibe la pantalla por Zoom. Las URLs firmadas académicas se renuevan a los 10 minutos; las URLs blob locales se liberan al quitar la escena o salir.

Una escena de pantalla exige elegir una fuente real con miniatura. Main custodia un vínculo efímero a pantalla, ventana o pestaña; no se enlaza por un nombre escrito. Compartir usa la fuente de la escena activa sin volver a elegirla y detener conserva su vínculo. Se puede Cambiar fuente si se cierra. Solo hay una captura local de pantalla a la vez; cambiar escena reemplaza sus pistas. Las pestañas siguen su navegación mientras exista la misma vista/perfil. No se conservan permisos de captura entre cierres del estudio.

## Medios y SDK

MediaDevices enumera dispositivos reales y captura solo después de una acción humana. Cada fuente tiene dueño, cancelación por generación y liberación al salir. Cambiar entrada conserva la fuente previa si falla. El medidor usa audio real sin retorno; el selector de salida prueba un tono cuando el entorno soporta `setSinkId`.

Al conectar la llamada se liberan las capturas de prueba, se conservan vínculos y
el SDK administra sus dispositivos. El micrófono se silencia por API y la cámara
desde sus controles oficiales. Compartir sigue iniciándose desde la llamada.
En modo directo main entrega la fuente ligada y cambiar escena detiene esa pista.
El instructor puede preparar una salida continua: el programa compone láminas,
pantallas autorizadas, imágenes, videos silenciosos y pantallas del curso en un
canvas estable. La llamada captura un WebContents dedicado y conserva su pista
al pasar entre escenas. La cámara de la llamada no forma parte de ese canvas.
No se usan selectores DOM internos, métodos SDK inventados ni cámara virtual.

### Escenas y salida compacta
Un único monitor comparte espacio con el dock de escenas a todo el ancho. Los estados y controles de medios permanecen en la barra inferior. Las escenas
se seleccionan en filas compactas; cuatro filas quedan visibles sin desplazar
el escenario a 1280×720. Solo la lista de escenas largas tiene scroll interno.
Activar salida prepara la pista continua por acción explícita. Una vez activa,
seleccionar una fila cambia directamente el programa mediante corte. Si falla
la carga, conserva la escena anterior y muestra el error. No hay controles de
efectos, duración ni contenido intermedio. Nueva escena conserva pantallas del
curso con texto y reloj opcional.
La salida se prepara por acción explícita y
solo se identifica como compartida cuando la llamada confirma compartir. Antes
de pasar de compartir directo a programa se debe detener la pista directa.
Espera, inicio, receso y cierre se crean desde Nueva escena,
que permite personalizar título, descripción y cuenta regresiva. El reloj empieza
al pasar a programa y permanece en cero; no reactiva una pantalla o cámara.
No se puede quitar la escena actual del programa.
Durante el cambio se bloquea la edición del banco. Cerrar salida detiene compartir
y libera los recursos; no cambia la política de grabación ni repetición Learning.

Una ventana oculta recibe solo video del canvas mediante WebRTC local sin
STUN/TURN. Tiene preload exclusivo y se captura como WebFrameMain; nunca comparte
los paneles del instructor. La composición conserva ejecución en segundo plano
mientras la salida está abierta y restaura la política previa al cerrarla.
Las fuentes entrantes se validan antes del cambio y las salientes se liberan al
terminar. En movimiento reducido se usa corte; el intermedio conserva su duración
sin fundidos. [Plan y decisiones](../../openspec/changes/add-studio-transitions/design.md).

Meeting SDK 6.5.0 usa React 18.3.1 en un paquete privado con lockfile propio, sin forzar su instalación contra React 19 de Hub. Se compila al construir la aplicación y carga desde `soflia-zoom://meeting`, con CSP y protocolo que solo sirve documento y assets compilados. El iframe no comparte preload, identidad ni almacenamiento del renderer. Comunicación limitada por ventana, origen y nonce. La firma y ZAK se obtienen exclusivamente en Learning; no se guardan en disco ni se incluyen en URLs.

## Contratos y pruebas
El aula del participante separa escenario/actividades de una columna de conversación
que ocupa toda la altura disponible. Comparte iconos, tokens y chat académico con
el instructor, sin sus controles de producción. Una barra flotante reúne medios,
solicitud de palabra, reacciones y un único acceso a salas asignadas. El espacio
final dentro de las listas permite alcanzar entregas o materiales mientras la
barra flota sobre la parte inferior de actividades, sin un hueco externo.
En contenedores estrechos se alternan Clase y Conversaciones sin desmontar borradores.
El asa de la barra permite moverla dentro del área de clase y contraer sus acciones.
Pointer capture mantiene el arrastre; umbral de movimiento evita confundir clic
con arrastre, y ResizeObserver ajusta límites. Flechas/Escape ofrecen alternativa
de teclado. La conexión explícita vive como icono sobre el escenario; sus iconos
son overlays revelados por hover/foco y permanecen visibles en equipos sin hover.
Ocultar o mover controles no cambia dispositivos ni conexión.
Los tamaños de paneles son estado visual de cada vista, con un separador común
accesible (`StudioResizeHandle`) y medición acotada por `ResizeObserver`. El alumno
ajusta chat y altura de actividades; el instructor ajusta ambos laterales y el
dock de escenas. El arrastre usa captura de puntero y desactiva temporalmente la
intercepción del iframe mediante CSS dentro de la región que se redimensiona.
Flechas/Home/End ofrecen el mismo ajuste; doble clic/Enter restablece y Escape
cancela. Al cambiar viewport se limita el valor efectivo, preservando la preferencia
para cuando vuelva a haber espacio. Los paneles y medios permanecen montados.
No hay persistencia, contratos HTTP/IPC, solicitudes de red ni permisos nuevos.

La ayuda individual Soflia envía solo pregunta, historial de esa conversación y
título/instrucciones de la práctica elegida a la IA configurada en Hub. Antes de
cada solicitud consulta el contrato workspace existente: identidad y sesión deben
coincidir, IA debe estar habilitada y el consentimiento debe corresponder a la
versión vigente. Ante ausencia o error bloquea la generación. No usa herramientas,
archivos, claves de quiz ni chat público. La conversación vive en memoria, con
cancelación al salir, 45 segundos de espera y límites de 2000 caracteres de entrada
y 8000 de salida. No sustituye el consentimiento académico por un clic en enviar.

Los controles del padre usan ventana, origen, nonce y esquemas estrictos para
capacidades y captions. Video SDK reporta micrófono/cámara reales y subtítulos
cuando la cuenta/anfitrión los permiten. Meeting conserva sus controles oficiales
para las funciones no expuestas por el adaptador. Fullscreen incluye escenario,
controles y último subtítulo temporal, sin guardar una transcripción en Hub.
El Video SDK publica listas acotadas de dispositivos y selección confirmada por
la llamada. El padre valida los payloads y envía solo tipo/ID; el iframe comprueba
que el ID existe antes de cambiarlo. Fuentes apagadas conservan una preferencia
sin capturar; activas usan los métodos switch del SDK. Meeting usa su selector
oficial y no presenta la prueba local como configuración de llamada.

El chat académico conserva una sola fuente de mensajes en Learning, independiente
del transporte audiovisual. Submit serializado evita Enter duplicado, conserva
texto escrito durante el envío y nunca publica tras una restricción local conocida.
El servidor sigue siendo la autoridad. Realtime muestra conexión y reintento;
la recuperación completa vuelve a leer, suscribir y renovar presencia. Una
suscripción antigua pendiente no puede cerrar la de una sesión posterior.
Reacciones y mensajes son comandos distintos: los primeros tienen eventos de cinco
segundos aislados por sala, sin incrementar el chat. El intervalo de mensajes es
configuración del instructor y usa una marca separada de los últimos cien mensajes.
Learning aplica ambas cadencias en dominio y RPC bajo bloqueo de sesión, con hora
de base de datos. El cliente usa reloj monotónico relativo al snapshot para la
cuenta regresiva, y deja de actualizar el reloj cuando vence su plazo. HTTP 429
se clasifica `rate_limited` y no se reintenta como un fallo de red.

La ampliación del contrato se negocia por cabecera `X-Soflia-Studio-Participation: 1`;
los consumidores anteriores reciben el snapshot sin campos de participación.
La respuesta confirma `snapshot.participation_version: 1`; sin confirmación se
ocultan ajustes de cadencia y reacciones, conservando el chat y medios anteriores.
Hub mantiene la unión Meeting/Video del contrato existente; ampliar su esquema
no activa un proveedor Video en el servidor ni modifica su configuración.

La grabación automática y sus repeticiones usan el contrato recordings dentro
del canal studio existente. Learning conserva runs/files/jobs privados y el
permiso de publicación; Hub observa recording-change y muestra el estado real.
Los instructores utilizan anfitriones centrales de Soflia. Activación y archivo
se describen en [operación de grabaciones](../operations/webinar-recordings.md).
La selección de pantalla usa la [interfaz local de compartir](ipc-and-integrations.md#selector-local-de-pantalla),
con miniaturas reales, búsqueda y categorías de pantallas, ventanas y pestañas
materializadas del navegador del Hub. Abrir o seleccionar una tarjeta no inicia
la transmisión: el usuario confirma Compartir. El Meeting SDK mantiene sus
controles de llamada, pero sus solicitudes de captura pasan por este selector
propio sin cuadros nativos de Windows.


Los cuatro canales nuevos son `learning-live:studio`, `learning-live:watch-studio`, `learning-live:unwatch-studio` y `learning-live:studio-event`. Pasan por servicio main, handler, allowlist, API preload y wrapper tipado. Se comparte un presupuesto de cuatro solicitudes; cerrar, cambiar de sesión o cancelar una suscripción pendiente invalida su generación y libera listeners/canales. Los errores se traducen sin devolver cuerpos ni secretos del proveedor.

La fuente del contrato y dominio es Learning: `node scripts/quality/sync-learning-studio.mjs --check` comprueba la copia de Hub. `LEARNING_CHECKOUT` permite señalar otro checkout de desarrollo. El paquete distribuido no depende de carpetas externas.

La fixture visual anterior en `test/manual/live-sessions/` conserva ejemplos de diseño. La prueba funcional en `test/manual/live-studio-runtime/` arranca con `npx vite --config test/manual/live-studio-runtime/vite.config.mts`. Ofrece dos identidades explícitas en localhost:4321, dominio compartido, servidor HTTP y eventos SSE. Su estado en memoria se pierde al reiniciar o recargar configuración de Vite. No autentica cuentas reales, no usa Supabase de producción y no simula un ingreso Zoom exitoso. La captura local sí usa dispositivos del equipo.

Las pruebas SQL de Learning ejecutan migración reentrante, RLS, autorización, idempotencia, CAS y presencia concurrente en PGlite. La prueba `node scripts/quality/smoke-zoom-runtime.mjs` ejecuta Electron oculto y confirma carga del frame con la CSP real y origen aislado; no acredita ingreso, audio o video de una reunión.

Despliegue, configuración y barreras pendientes están en [operación del estudio](../operations/live-studio-runtime.md). Los cambios anteriores de diseño quedan como antecedentes en [diseño del instructor](../../openspec/changes/design-instructor-live-studio/design.md) y [reinicio del aula](../../openspec/changes/redesign-live-sessions/design.md). La práctica guiada por orbe conserva su contrato independiente en [acompañamiento visual](autonomous-orb-guidance.md).
