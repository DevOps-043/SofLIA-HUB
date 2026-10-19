## Purpose
Preparar contenido de una clase y pasar a una salida continua mediante transiciones,
incluidas pantallas reutilizables para los momentos del curso.

## ADDED Requirements
### Requirement: Preparación y programa distintos
El instructor SHALL poder seleccionar contenido en vista previa sin alterar el
programa, y pasarlo explícitamente a salida con corte, fundido o barrido y duración
acotada. Un destino que falla no SHALL sustituir el programa anterior.
#### Scenario: Preparar siguiente contenido
- **WHEN** se selecciona otra escena con salida preparada
- **THEN** la salida conserva su contenido hasta pulsar Pasar a salida
#### Scenario: Cambios concurrentes o fallo
- **WHEN** se solicita otro cambio mientras uno sigue activo o la fuente falla
- **THEN** no se superponen cambios ni se publica una fuente alternativa

### Requirement: Pantallas del curso
El estudio SHALL ofrecer espera, inicio, receso y cierre con texto editable y
cuenta regresiva opcional. El reloj comienza al pasar a salida, conserva su fecha
límite y permanece en cero sin activar otra escena. Audio y cámara de la llamada
no SHALL cambiar por mostrar una pantalla de curso.
#### Scenario: Receso finalizado
- **WHEN** la cuenta regresiva del receso llega a cero
- **THEN** permanece la pantalla hasta la siguiente decisión del instructor

### Requirement: Recursos y continuidad
Cambiar de escena SHALL conservar la pista de salida y liberar recursos salientes
al concluir la transición. El banco no SHALL quitar una escena en programa.
#### Scenario: Fuente de pantalla cerrada
- **WHEN** una pantalla de programa deja de estar disponible
- **THEN** se muestra indisponibilidad sin capturar otra ventana por nombre

### Requirement: Imagen o pantalla intermedia
El instructor SHALL poder elegir una imagen, lámina o pantalla autorizada del
banco como contenido intermedio entre escenas, durante 500–10000 ms. El contenido
SHALL cargarse antes de modificar programa y liberarse al terminar. La pista
SHALL conservarse. El movimiento reducido SHALL mantener el contenido y su
duración utilizando cortes. El mismo contenido SHALL poder seleccionarse como
escena de espera de duración indefinida mediante Pasar a salida.
#### Scenario: Mostrar identidad visual entre escenas
- **WHEN** el instructor elige una imagen intermedia y pasa otra escena a salida
- **THEN** se muestra la imagen durante el intervalo configurado y luego el destino
#### Scenario: Contenido intermedio inválido o cancelación
- **WHEN** el contenido no está disponible, coincide con el destino o falla
- **THEN** el programa anterior se conserva y se informa el error
#### Scenario: Cerrar durante el cambio
- **WHEN** se cierra la salida durante la preparación o la transición visual
- **THEN** se liberan las fuentes y no se publica el destino posteriormente
