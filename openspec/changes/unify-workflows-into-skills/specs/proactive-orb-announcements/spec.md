## Purpose

Definir cómo SofLIA se dirige al usuario **sin que él haya iniciado la
conversación**: cuando una Skill pasiva tiene activo el canal Computadora, la
orbe aparece y locuta el resultado. Es la primera vez que el producto habla por
iniciativa propia, así que la capacidad fija también sus límites: cuándo NO debe
aparecer y cómo se calla.

## ADDED Requirements

### Requirement: Anuncio proactivo en la orbe

Cuando una Skill pasiva con el canal Computadora activo produzca un resultado,
el sistema SHALL mostrar la orbe y locutar el resultado con la voz configurada.
La orbe SHALL mostrar también el texto del anuncio, de modo que el resultado
siga siendo legible si el usuario no puede oírlo.

#### Scenario: Llega la hora de una rutina con canal Computadora

- **WHEN** se cumple la programación de una Skill pasiva cuyo canal Computadora está activo
- **THEN** la orbe aparece sobre el escritorio, locuta el resultado y muestra su texto

#### Scenario: El usuario no puede oír el anuncio

- **WHEN** la síntesis de voz falla o el equipo no tiene salida de audio
- **THEN** la orbe aparece igualmente con el texto del anuncio, sin quedarse en silencio y sin contenido

### Requirement: El anuncio respeta las guardas de la orbe

El anuncio proactivo SHALL estar sujeto a las mismas guardas que rigen la orbe.
El sistema MUST NOT mostrar la orbe ni locutar nada sin una sesión iniciada. Al
cerrarse la sesión, los anuncios pendientes SHALL descartarse.

#### Scenario: No hay sesión iniciada

- **WHEN** se dispara una Skill pasiva con canal Computadora y no hay ninguna sesión iniciada en la aplicación
- **THEN** el sistema no muestra la orbe, no locuta nada y deja constancia de que el anuncio se omitió

#### Scenario: La sesión se cierra con un anuncio pendiente

- **WHEN** el usuario cierra sesión mientras hay un anuncio pendiente de mostrarse
- **THEN** el anuncio se descarta y la orbe no aparece

### Requirement: El anuncio no secuestra el equipo

El anuncio SHALL aparecer sin robar el foco de la ventana en la que el usuario
está trabajando. El usuario SHALL poder silenciarlo y cerrarlo en cualquier
momento. Varios anuncios que coincidan en el tiempo MUST NOT solaparse en voz:
el sistema SHALL entregarlos en orden.

#### Scenario: El usuario está escribiendo en otra aplicación

- **WHEN** aparece un anuncio proactivo mientras el usuario escribe en otra ventana
- **THEN** la orbe se muestra sin capturar el foco y lo que el usuario escribe sigue llegando a su aplicación

#### Scenario: El usuario silencia el anuncio

- **WHEN** el usuario detiene la locución o cierra la orbe durante un anuncio
- **THEN** la voz se detiene de inmediato y la orbe se oculta

#### Scenario: Dos rutinas coinciden a la misma hora

- **WHEN** dos Skills pasivas con canal Computadora se disparan en el mismo minuto
- **THEN** el sistema locuta el primer anuncio, espera a que termine y locuta el segundo, sin superponer las dos voces

### Requirement: Continuidad con la conversación de la orbe

Tras un anuncio, la orbe SHALL quedar disponible para conversar sin que el
usuario tenga que invocarla de nuevo, y el anuncio SHALL formar parte del
contexto de esa conversación.

#### Scenario: El usuario responde al anuncio

- **WHEN** el usuario habla a la orbe justo después de un anuncio para pedir más detalle
- **THEN** SofLIA responde entendiendo a qué se refiere, sin pedir que repita el tema del anuncio
