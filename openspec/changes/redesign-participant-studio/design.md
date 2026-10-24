## Decisions
Escenario a la izquierda, chat lateral al borde inferior y actividades/materiales debajo del escenario. Un solo botón Salas abre la asignación académica y el regreso al principal. La barra se posiciona sobre el área del escenario con espacio reservado para no cubrir contenido. En tamaños estrechos se elige Clase o Chat conservando estado.

Soflia usa generación de texto sin herramientas ni acceso a otras aplicaciones. Solo envía la pregunta humana, historial de esta conversación y contexto mínimo del título y práctica abierta; no envía claves, chat público, URLs ni archivos. Conversación en memoria ligada a usuario/sesión; no se publica. Cancelación por señal y al salir; límites de entrada/salida y errores visibles.

Medios de llamada se controlan en el runtime Video SDK y reportan estado confirmado. Meeting conserva controles oficiales cuando no expone un método. Los subtítulos son optativos para el observador, dependen del proveedor/anfitrión y no se guardan como transcripción en Hub. Fullscreen usa el elemento contenedor del escenario para incluir controles y subtítulos.

Levantar mano y reacciones utilizan mensajes académicos confirmados en la sala actual, indicando el alcance; no simulan un evento audiovisual. Salas académicas no acreditan traslado de audio.
## Validation
Antes de cada generación, workspace debe confirmar política de IA habilitada,
consentimiento vigente e identidad/sesión coincidentes. La ausencia del contrato
o un fallo bloquea el envío sin contactar al proveedor.

Probar envío en sala, separación de chats, moderación, quiz/entrega con errores, fullscreen denegado, controles sin conexión, captions no disponibles, cancelación IA y respuesta tardía. Revisar 1280×720 y móvil. Gate con excepción Gmail preexistente documentada si persiste.
