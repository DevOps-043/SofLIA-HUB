# Revisión adversarial

Estado: revisión local de implementación y evidencia; sin archivo del cambio; publicación en rama aislada autorizada por el usuario.

## Hipótesis y correcciones

- **Cuencas residuales y expresiones indistinguibles.** La composición inicial de ojos raster dejaba parches oscuros al ocultarlos. Se retiraron esos ojos del render, se uniformó toda la máscara del visor con una muestra original y se implementaron doce trazos SVG distintos siguiendo la referencia del usuario. Check, advertencia, duda y pensamiento se ampliaron con margen dentro del visor. La lámina y la prueba de variantes cubren esta regresión.
- **Voz congelada al perder foco.** La pausa inicial por blur interfería con la ventana flotante mientras se trabaja en otra aplicación. Blur ahora sólo devuelve mirada al centro; la prueba mantiene amplitud y un RAF sin foco. Ocultamiento real y movimiento reducido sí suspenden.
- **Carrera en cambio de preferencia.** El navegador puede reflejar la media query antes de entregar su evento. El RAF reconcilia también su estado al detectar una condición de pausa; se verificaron reducción y reanudación en navegador real.
- **Decoración antigua reaparece tras una fase crítica.** Un estado declarativo nuevo descarta el override imperativo, incluso al regresar al estado original. Cubierto por prueba específica.
- **Reset no interrumpe un parpadeo consumido.** Un token de reset cancela el cierre ocular interno y el gesto, sin dejar acciones pendientes.
- **Captura o permisos de audio adicionales.** El componente sólo lee refs; no importa servicios de voz, IPC o herramientas. La fixture usa un archivo local elegido, sin getUserMedia. La conversación existente sigue cubierta por sus pruebas.
- **Exportaciones divergentes del componente.** GIF y WebM se generan mediante capturas del mismo renderer; las muestras de amplitud para la exportación se identifican como demostración. La prueba de audio usa WAV medido y confirma caída al pausar.
- **Fugas y bucles duplicados.** StrictMode, observers, desmontaje, cambios de estado y visibilidad están cubiertos. No hay temporizadores de gestos ni loops RAF adicionales dentro del avatar.
- **Coordenadas obsoletas al desplazar un ancestro.** Cada evento del puntero consulta el rectángulo actual del rostro, además de los observers de tamaño y scroll. La prueba desplaza el componente sin cambiar dimensiones y comprueba que la mirada conserva su dirección.
- **Símbolos oscuros al pausar.** La transición de entrada no queda detenida a opacidad parcial; la pausa mantiene el símbolo estático con opacidad completa, comprobado en navegador.

## Revisión de gestos autónomos

Se comprobó que los doce estados cambian de pose con amplitud cero, sin puntero
ni acciones imperativas. Confirmación elimina insignia/palomita y repite un
asentimiento vertical sin decaimiento, deriva ni inclinación lateral. El gesto
manual nod también se expresa en píxeles verticales. Un único RAF mantiene los
perfiles y los observers continúan suspendiéndolos al ocultarse o reducir
movimiento. La onda ambiental de disponibilidad no modifica la amplitud medida.
La medición en navegador espera el final de la interpolación desde la pose
anterior antes de exigir ausencia de rotación en Confirmación.

La revisión de fluidez añadió pruebas para impedir que cambiar de expresión
reinicie la pose a cero y para agrupar ráfagas de puntero en una lectura por
fotograma. Se retiraron las inclinaciones base instantáneas y la interpolación
CSS duplicada. La comprobación en navegador también contrasta posición y ángulo
antes y después del cambio Curiosidad → Alegría.

## Revisión de rostro, audio y señales exteriores

- El asentimiento facial supera ampliamente la flotación del cuerpo, sin volver a una palomita. Se midieron ambas matrices en navegador.
- La estimación de registro reutiliza 2048 muestras cada 50 ms, requiere confianza y rechaza silencio, entradas inválidas y tonos fuera de rango para no afirmar una octava inferior falsa. Promedio local calentado: 0.068 ms por estimación, 200 iteraciones.
- La prueba con nodo existente no crea AudioContext ni llama getUserMedia; desmontar sólo desconecta su analizador. Permiso denegado deja energía cero y ningún RAF activo.
- La boca toma amplitud y bandas del audio real. Una prueba WAV confirma apertura y cierre; sus formas no se presentan como fonemas alineados ni gestos semánticos.
- Un WAV grave/suave de 140 Hz y otro agudo/fuerte de 480 Hz producen registros 0.2685 y 0.8493, energía 0.586 y 1, y distinta distribución de onda.
- Zzz vive fuera de las capas cuerpo/visor, sin eventos propios ni bucles JS; sus animaciones se pausan y existe alternativa estática para movimiento reducido.
- El recorrido ocular se mantiene acotado y el retorno es gradual, sin usar el cuerpo para seguir el cursor. Sorpresa y Preocupación son expresiones explícitas, no inferencias automáticas sobre el usuario.

## Riesgo residual de la versión actual

La revisión es local, no una revisión independiente de otra persona. No se realizó una llamada remota de ElevenLabs ni se ejecutó el instalador WPF completo: se comprobó su bundle web compartido. La extracción del contorno procede de una fuente aplanada y la pantalla interior se modifica por solicitud expresa. El rendimiento medido sólo describe este equipo. El código 3D anterior se conserva fuera de los imports para facilitar reversión, sin cargarse en runtime.

## Integración en Hub

Revisión local adicional previa al push autorizado, sin archivo OpenSpec:

- Se intentó inducir éxito con resultados inválidos, pendientes y fallidos: sólo el éxito estructurado concluyente celebra; desconocidos confirman sin prometer resultados.
- Se verificaron permisos denegados/cancelados y conteo de observación; el observador no cambia decisiones ni recuerda autorizaciones.
- Se detectó que un callback anterior podía limpiar la carga de otro turno: el cierre exige propietario vigente y cambiar de ámbito limpia su estado explícitamente.
- Se preservó la continuidad del primer borrador al recibir su ID persistido; cambiar conversación descarta el estado anterior.
- Se evitó que un resultado histórico en segundo plano dominara las nuevas respuestas: se exige vínculo con mensaje/conversación y su gesto cede al cambiar la versión del turno.
- Se intentaron inyección y dependencias remotas en el inicio: el borrador no entra como HTML, sólo se clonan SVG locales; un hash autoriza el único script y se conservan connect-src none, form-action HTTPS y rechazo de rutas/credenciales/parámetros.
- La máscara SVG se embebe en el documento nativo, evitando solicitudes de recursos bloqueadas por CSP. El hash se calcula después de normalizar CRLF.
- Se comprobó que el analizador del dictado no pide otro micrófono ni detiene las pistas prestadas; cierra su propio contexto.
- El personaje activo usa un RAF; las marcas del historial son PNG para evitar un bucle por mensaje. Los brillos escalan con el tamaño para mantener trazos legibles.

Riesgo residual: reglas de borrador y texto son heurísticas decorativas; el TTS no
ofrece fonemas alineados. La QA de integración usa componentes reales con eventos
simulados y proveedores de prueba, sin ejecutar tareas externas o una sesión
autenticada de producción. La medición local de fluidez no garantiza otros equipos.

- El cierre del dictado por silencio no cuenta como interacción: una prueba verifica reposo a los 20 segundos desde el último uso, sin sumar los ocho segundos del timeout de voz.
