## Decisions
Reacciones/ritmo de chat: eventos propios con emoji permitido, identidad del servidor,
ventana de cinco segundos y máximo cien eventos, visibles solo en la sala actual
(el instructor puede observar cualquier sala). No se insertan mensajes de chat.
El permiso de reacciones es independiente de modo lectura y del intervalo de chat;
acceso bloqueado sí lo impide. Cadencia de reacción de un segundo por actor.

El instructor define de 0 a 300 segundos entre mensajes (0 desactiva, inicial 0).
Solo limita participantes y se aplica globalmente en la sesión, incluso al cambiar
de sala o reconectar. Ledger de última participación separado del historial de cien
mensajes, privado en la proyección del usuario y con poda acotada. Validación de
dominio y RPC serializada: concurrencia e idempotencia no deben saltar la espera.
La UI muestra cuenta regresiva sin borrar el borrador. Requiere publicación
coordinada del contrato Learning/Hub y migración incremental; no se ejecuta SQL remoto.
Compatibilidad: el HTTP nuevo negocia con cabecera `X-Soflia-Studio-Participation: 1`
sin ampliar el JSON, para que la API anterior pueda abrir el aula. El backend sin
negociación devuelve la forma previa sin nuevos campos. Publicar backend compatible
antes que Hub. Mantener la unión Meeting/Video ya consumida por Hub, sin activar
proveedor ni cambiar secretos.
La respuesta nueva confirma `snapshot.participation_version: 1`. Sin confirmación,
Hub conserva el chat/medios anteriores y no ofrece los comandos nuevos. No hay
reintento ni cambio de permisos cuando un servidor devuelve 401/403.
Revisión de controles: se retira el ingreso del encabezado y se conserva una
acción explícita de conexión como icono sobre el video. El escenario elimina la
franja fija: solo muestra botones en hover, foco de teclado o dispositivos táctiles.
La barra de participación incorpora asa arrastrable y colapsable, con movimiento
por flechas, límites del área y ajuste al redimensionar. Posición solo en memoria;
contraer no cambia micrófono, cámara ni conexión. Ninguna captura automática.
Revisión del 24 de octubre: el usuario solicita actividades hasta abajo y barra
superpuesta. El área académica deja de reservar un hueco externo para la barra;
el contenido desplazable conserva margen final para poder acceder a sus botones.
El chat académico sigue siendo la fuente única de mensajes, sin un segundo chat
nativo Zoom. Debe conservar borradores durante envíos/fallos y mostrar conexión
real y recuperación. La configuración de dispositivos de llamada usa el SDK
aislado; no debe modificar una captura local mientras se presenta como audio Zoom.
Escenario a la izquierda, chat lateral al borde inferior y actividades/materiales debajo del escenario. Un solo botón Salas abre la asignación académica y el regreso al principal. La barra flota sobre el área de clase y puede moverse o contraerse; las listas conservan margen final desplazable. En tamaños estrechos se elige Clase o Chat conservando estado.

Soflia usa generación de texto sin herramientas ni acceso a otras aplicaciones. Solo envía la pregunta humana, historial de esta conversación y contexto mínimo del título y práctica abierta; no envía claves, chat público, URLs ni archivos. Conversación en memoria ligada a usuario/sesión; no se publica. Cancelación por señal y al salir; límites de entrada/salida y errores visibles.

Medios de llamada se controlan en el runtime Video SDK y reportan estado confirmado. Meeting conserva controles oficiales cuando no expone un método. Los subtítulos son optativos para el observador, dependen del proveedor/anfitrión y no se guardan como transcripción en Hub. Fullscreen usa el elemento contenedor del escenario para incluir controles y subtítulos.

Levantar mano y reacciones utilizan mensajes académicos confirmados en la sala actual, indicando el alcance; no simulan un evento audiovisual. Salas académicas no acreditan traslado de audio.
## Validation
Antes de cada generación, workspace debe confirmar política de IA habilitada,
consentimiento vigente e identidad/sesión coincidentes. La ausencia del contrato
o un fallo bloquea el envío sin contactar al proveedor.

Probar envío en sala, separación de chats, moderación, quiz/entrega con errores, fullscreen denegado, controles sin conexión, captions no disponibles, cancelación IA y respuesta tardía. Revisar 1280×720 y móvil. Gate con excepción Gmail preexistente documentada si persiste.
