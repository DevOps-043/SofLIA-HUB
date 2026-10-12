# Acompañamiento visual de SofLIA

Estado: implementación local. Actualizado: 2026-10-12.

<!-- evidence: electron/orb-guidance/service.ts -->
<!-- evidence: electron/orb-guidance/surfaces.ts -->
<!-- evidence: src/shared/orb-guidance.ts -->
<!-- evidence: electron/orb-guidance/handlers.ts -->

SofLIA reutiliza el orbe existente y lo convierte en una presentación compacta
durante una indicación. El controlador calcula posiciones en DIP de escritorio,
evita el objetivo y conserva la posición de descanso del modo conversación.
Los desplazamientos automáticos no se guardan como preferencias del usuario.

## Movimiento y marcas

El [coordinador main](../../electron/orb-guidance/service.ts) mantiene fase,
revisión, objetivo, estilo y práctica. Las [superficies](../../electron/orb-guidance/surfaces.ts)
animan la ventana y crean marcas por monitor. Marco, halo, flecha y foco viven en
un documento local sin preload, Node, recursos remotos ni entrada del mouse.
Sólo la ventana del orbe recibe controles del usuario. Durante un arrastre,
el orbe deja pasar los eventos para no interceptar el destino.

La animación dura 280 ms y respeta movimiento reducido. Tras presentarse, la
indicación dispone de 180 ms antes del efecto nativo. Una marca de Computer Use
caduca a los 1500 ms; una indicación explícita permanece hasta 8 segundos. Cambiar
el estilo no anula la caducidad. Las marcas no representan evidencia de que una
acción se haya realizado.

## Integración con Computer Use

La ejecución de entrada carga nut.js mediante `createRequire` en ESM y usa
scripts PowerShell completos con errores terminantes para el fallback. La tecla
Windows/Super tiene síntesis nativa; teclas desconocidas producen rechazo.
`type_text_at` conserva su coordenada y enfoca antes de escribir. Acciones
desconocidas no son noops exitosos. Una respuesta con varias acciones conserva
la cola completa antes de solicitar otra inferencia.

En escritorio, cada acción deja 400 ms de asentamiento antes de observar. El
cierre recaptura la pantalla y consulta una comprobación sin herramientas: valida
el estado final en la aplicación objetivo, no las afirmaciones del chat ni pasos
transitorios ya cerrados. Un error de entrada pendiente impide declarar éxito.
La corroboración por visión sigue siendo probabilística y no sustituye pruebas
de entrada física o una condición determinista de negocio.

El [ejecutor de escritorio](../../electron/desktop-agent/service-action-runtime.ts)
presenta coordenadas después de resolverlas, incluyendo cajas UIA/OCR cuando
existen. Comprueba generación de guía, señal de cancelación y captura vigente
antes de actuar. En Windows, el worker existente compara el handle y bounds de
la ventana durante la indicación. El clic semántico vuelve a localizar el elemento
antes de aplicar la entrada física.

El [driver del navegador](../../electron/integrated-browser/cu-driver.ts) transforma
su viewport al escritorio usando la ventana anfitriona y el WebContentsView.
Conserva guardas de página/perfil y revalida geometría después de esperar. Las
operaciones DOM deterministas comprueban también estado editable, habilitado y
oclusión después de la indicación. No se mueve el puntero para desplazar el orbe.

Pausar impide iniciar la siguiente acción. Una coordenada retenida durante la
pausa se rechaza al reanudar, obligando al motor a observar de nuevo. Detener,
ocultar el orbe, cambiar sesión o cambiar monitores cancela la asistencia. Una
acción nativa ya iniciada puede terminar; la guía no revierte efectos aplicados.
La liberación del mouse no espera una presentación pausada.

Las capturas del agente ocultan temporalmente orbe y marcas y esperan 32 ms al
compositor. Renderizar una indicación espera a que concluyan las capturas activas.
Cerrar la asistencia impide que una captura tardía vuelva a mostrarla. Puede haber
parpadeo durante este ocultamiento; la composición depende del SO y requiere QA.

## Prácticas e instrucciones explícitas

En el estudio del instructor, **Práctica con SofLIA** permite definir de 1 a 20
pasos. Cada paso contiene una instrucción, el texto visible que se señala y el
texto visible esperado como resultado. **Comprobar paso** consulta UIA/OCR; si
no encuentra ese resultado, conserva el paso. Fallos de captura permiten reintentar.
El seguimiento solicita una sola observación a la vez y reprograma la siguiente
a los 2500 ms de terminar; pausa, cancelación y cierre invalidan respuestas tardías.

Esta comprobación confirma presencia visual del texto definido; no demuestra
por sí sola aprendizaje, corrección de datos ni ejecución de una acción concreta.
El instructor debe escoger condiciones distintivas del resultado y ensayarlas
en la aplicación real. La práctica bloquea el inicio de Computer Use mientras el
alumno actúa. La receta y estado viven en memoria y no se publican al grupo.

La herramienta renderer `show_visual_guidance` permite pedir que SofLIA señale
un control por su nombre sin clicar ni escribir. Usa el catálogo de Computer Use
existente y falla si no encuentra el texto, hay una práctica activa o el agente
está ejecutando otra tarea. Solicitudes antiguas no sustituyen objetivos recientes.

## Fronteras y límites

El [contrato compartido](../../src/shared/orb-guidance.ts) valida entradas cerradas.
`orb:guidance-get`, `orb:guidance-control`, `orb:guidance-show`,
`orb:practice-start`, `orb:practice-check` y `orb:guidance-state` pasan por
[handlers](../../electron/orb-guidance/handlers.ts),
[preload](../../electron/preload/orb-guidance-api.ts) y
[wrapper tipado](../../src/services/orb-guidance-service.ts).
Sólo los frames principales actuales del Hub y Orbe autenticados pueden usarlos.
No se aceptan coordenadas ni funciones genéricas de ventana desde IPC. La guía
no concede permisos de entrada ni sustituye HITL.

Webinars conserva el [alcance local actual del aula](learning-live-workspace.md).
Esta entrega no transmite medios ni sincroniza señales entre participantes.
La cobertura de controles depende de UIA/OCR; plataformas sin UIA y aplicaciones
opacas pueden ofrecer sólo señalización puntual o no localizar un texto.

## Validación y reversión

Las pruebas de geometría, servicio, superficies, IPC, driver y UI cubren pausa,
cancelación, cambios de contexto y errores. La evidencia está en
[el cambio OpenSpec](../../openspec/changes/add-autonomous-orb-guidance/tasks.md).
Revertir el cambio restaura la conversación y arrastre anteriores sin migraciones
ni cambios en datos remotos. No se requiere instalar dependencias nuevas.
