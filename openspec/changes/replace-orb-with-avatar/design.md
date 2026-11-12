# Diseño

## DEC-AVATAR-01: conservar los píxeles originales

La primera imagen es la fuente principal. Una máscara SVG delimita el contorno y retira el fondo rectangular; el halo exterior se sustituye por una sombra 2D. Cuerpo, logo, bandas, luces y reflejos permanecen juntos. Las máscaras luminosas añaden pulsos sin deformar la estructura. El logo adjunto sirve para verificar identidad, sin sustituir el ya presente en la imagen aprobada. El PNG estático conserva cada píxel RGB visible original, comprobado mediante verify-assets.mjs.

La revisión del usuario exige retirar las cuencas oculares, ampliar iconos y seguir la lámina adjunta. Se aplica una muestra oscura uniforme del visor a su máscara interior y se usan señales SVG luminosas: barras en espera, onda al escuchar, puntos al pensar, cara con ojos abiertos y boca reactiva al responder, check grande de éxito, exclamación ámbar y pregunta grande de duda. Los estados restantes tienen trazos diferentes. Los ojos raster originales se entregan como recursos pero no se montan, evitando sombras o círculos residuales.

## DEC-AVATAR-02: API y prioridades

SofliaAvatar recibe estado, expresión opcional, ref de amplitud, configuración de mirada y movimiento. Su ref permite setState, setExpression, setAudioLevel, setGazeTarget, blink, nod y reset. Estados listening/thinking/acting/speaking/warning/success tienen prioridad sobre expresiones decorativas. acting usa focused. La mirada desplaza sólo las señales oculares, sin deformación; apertura y parpadeo son controladores separados. Los símbolos centrales no siguen el cursor. El estado declarativo nuevo descarta expresiones imperativas antiguas; reset cancela gestos incluso durante un parpadeo.

## DEC-AVATAR-03: ciclo de vida y audio

Un RAF actualiza variables CSS sin renders React por frame. Usa interpolación independiente de FPS, coordenadas normalizadas respecto al rostro y retorno fuera del radio configurable. IntersectionObserver, visibilitychange y prefers-reduced-motion suspenden o reinician el movimiento; blur devuelve mirada al centro sin cortar voz en una ventana flotante sin foco. Desmontar retira observers, listeners y RAF. Las señales de useAudioFeatures siguen siendo la única fuente de amplitud del modo voz; el avatar no solicita micrófono ni crea AudioContext. La ausencia de audio produce nivel cero.

## DEC-AVATAR-04: compatibilidad y validación

Revisión de expresiones: curiosidad usa ojos abiertos asimétricos y ceja elevada;
durmiendo muestra párpados relajados, respiración tenue y letras externas; confirmación
presenta un gesto amable y asentimiento vertical recurrente, sin insignia ni palomita. Respondiendo
tiene ojos abiertos y una boca independiente cuya apertura sigue amplitud real,
de modo que se diferencia de alegría y confirmación.

OrbCanvas mantiene su nombre y propiedades para voz, asistencia e instalador. Los atajos de flechas ahora dirigen la mirada; Inicio/Enter/doble clic restablecen. El instalador explica la interacción nueva. No se elimina geometría anterior hasta validar sustitución. Demo independiente del login y proveedores; audio de demostración identificado como sintético, con entrada real opcional desde un archivo elegido por el usuario. GIF y WebM se derivan del mismo componente.

## DEC-AVATAR-05: gestos autónomos permanentes

Todas las expresiones mantienen un gesto cíclico propio desde su montaje, sin
esperar puntero, audio o acciones imperativas. Confirmación elimina cualquier
palomita e insignia y asiente mediante desplazamiento vertical recurrente, sin
rotación lateral. Los perfiles de flotación, inclinación, respiración y pulso
comparten el RAF existente y conservan prioridad del estado. La amplitud medida
de audio permanece separada del gesto ambiental: una onda de escucha puede
mostrar disponibilidad sin inventar señal de micrófono. Ocultamiento, pausa
explícita y movimiento reducido suspenden estos gestos.

La fluidez usa una pose persistente entre cambios de expresión, interpolación
exponencial según delta temporal y transformaciones sin transición CSS adicional.
Las inclinaciones base también se interpolan. Los eventos de puntero se agrupan
por fotograma, las escrituras de estilos idénticos se descartan y los filtros de
brillo mantienen su radio constante. La iluminación recorre las bandas con una
onda continua, sin reinicios por módulo.

## DEC-AVATAR-06: expresividad facial y articulación acústica

El asentimiento se desplaza al rostro dentro del visor; el cuerpo conserva sólo
flotación leve. Los perfiles controlan traslación e inclinación faciales, apertura
ocular y cejas. La mirada aumenta su recorrido con retorno gradual al alejarse,
sin trasladar el cuerpo para simularla. Se agregan Sorpresa y Preocupación.

La fachada pasa amplitud, tono y bandas del analizador existente. Una estimación
local de frecuencia fundamental y confianza reutiliza sus muestras cada 50 ms,
sin otro micrófono, contexto ni proveedor. Si no es fiable se conserva el tono
espectral como referencia. Escuchando responde a registro, espectro y volumen.
La boca usa apertura, redondez y anchura continuas derivadas del audio TTS real.
Esta articulación acústica no afirma fonemas ni palabras alineadas: el contrato
actual de voz no entrega esa alineación. Pensando combina órbita, puntos y
pulsos. Todo se interpola en el único RAF visual y respeta las pausas existentes.

Las Zzz del sueño son una capa exterior al cuerpo y al visor, con animación de
transformación y opacidad. Se pausan con el controlador y muestran una marca
estática al reducir movimiento. La demo permite micrófono sólo por acción expresa
del usuario; la aplicación sigue reutilizando su fuente existente.

## Límites y reversión

La fuente aplanada impide separar fielmente todas las bandas. La máscara conserva el contorno visible sin inventar reversos. Los FPS se miden en el entorno local y no son garantía para todo hardware. Revertir los cambios del renderer recupera la ruta anterior; no hay migraciones ni efectos externos.
