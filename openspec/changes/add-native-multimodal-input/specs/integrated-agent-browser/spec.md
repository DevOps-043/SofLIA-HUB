## ADDED Requirements

### Requirement: Captura visual explícita invocable por el modelo

El navegador integrado SHALL exponer al modelo una captura visual de la pestaña activa bajo demanda, independiente del heurístico de intención del renderer y de la cadencia de la observación pasiva, que MUST devolver un frame fresco de la misma pestaña y sesión visibles.

#### Scenario: Frame solicitado durante contenido en movimiento

- **WHEN** el modelo solicita la captura explícita mientras la pestaña reproduce contenido que cambia
- **THEN** el sistema toma un frame nuevo en ese instante sin reutilizar la última captura pasiva ni esperar la cadencia multimedia

#### Scenario: Referencia visual que el heurístico no reconoce

- **WHEN** el usuario pregunta por un elemento, persona o acción visible sin usar verbos visuales que el enrutamiento reconozca
- **THEN** el modelo puede obtener la evidencia invocando la captura explícita, sin exigir al usuario reformular la pregunta

#### Scenario: Resolución adecuada al detalle solicitado

- **WHEN** la solicitud requiere leer texto pequeño, cifras o detalle fino del frame
- **THEN** la captura explícita conserva la resolución completa del viewport y no se reduce al presupuesto de la percepción pasiva

#### Scenario: Navegador no visible

- **WHEN** el navegador integrado no está visible o no hay pestaña activa
- **THEN** la captura explícita falla con un motivo declarado y el modelo no describe contenido de la pestaña

### Requirement: Evidencia visual no utilizable

El navegador integrado SHALL detectar cuando una captura no representa el contenido percibido por el usuario —contenido protegido que devuelve una imagen vacía o uniforme, o una captura fallida— y MUST declararlo en lugar de entregar esa imagen como evidencia.

#### Scenario: Contenido protegido por DRM

- **WHEN** la pestaña reproduce contenido protegido cuya superficie el compositor no entrega
- **THEN** el sistema declara que la reproducción está protegida y que no puede observarla, y el modelo no describe la escena

#### Scenario: Captura vacía o degenerada

- **WHEN** la captura resulta vacía o carece de contenido discernible
- **THEN** el sistema reporta el fallo con su causa y no incorpora la imagen como evidencia del turno

### Requirement: Comprensión del video en reproducción

El navegador integrado SHALL permitir que un turno analice el video en reproducción de la pestaña activa sin depender de transcripciones publicadas en la página, y MUST declarar la fuente y el intervalo utilizados.

#### Scenario: Video público direccionable

- **WHEN** la pestaña activa reproduce un video público accesible por URL y el usuario pregunta por su contenido
- **THEN** el sistema entrega al modelo el video por su URI, acotado a una ventana temporal alrededor de la posición de reproducción, y declara la fuente y el intervalo

#### Scenario: Reproductor no direccionable

- **WHEN** el video en reproducción no es públicamente accesible por URL
- **THEN** el sistema entrega una secuencia de frames muestreados de la pestaña con sus marcas de tiempo, y declara que la evidencia es un muestreo y no el video completo

#### Scenario: Posición de reproducción desconocida

- **WHEN** el sistema no puede determinar la posición actual de reproducción
- **THEN** la ventana se calcula desde el inicio del medio y el resultado declara que no se pudo alinear con la reproducción del usuario

#### Scenario: Ausencia de transcripción en la página

- **WHEN** la página no publica transcripción, subtítulos ni descripción del contenido
- **THEN** el sistema no solicita al usuario abrir la transcripción y resuelve el turno con la entrada de video o el muestreo de frames

#### Scenario: Lectura de video sin ampliar privilegios

- **WHEN** un turno analiza el video de la pestaña activa
- **THEN** la operación no interactúa con la página, no reproduce, pausa ni navega, y las acciones de escritura, envío o autenticación conservan sus guardas y confirmaciones vigentes
