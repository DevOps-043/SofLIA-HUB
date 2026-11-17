## ADDED Requirements

### Requirement: Capturas periódicas sin solapamiento
El sistema SHALL mantener una captura periódica en vuelo y MUST descartar resultados de revisiones obsoletas.

#### Scenario: OCR lento y varios ticks
- **WHEN** una captura continúa mientras vence otro periodo
- **THEN** no inicia otro pipeline periódico simultáneo

#### Scenario: Stop durante captura
- **WHEN** se detiene o cambia la sesión antes de terminar
- **THEN** no publica esa captura sobre la sesión nueva

### Requirement: Indexación serial y cancelable
El sistema SHALL conservar un timer de indexación y agrupar solicitudes concurrentes sin perder invalidaciones.

#### Scenario: Ráfaga de cambios
- **WHEN** llegan varios eventos durante una actualización
- **THEN** no solapa escaneos y recupera los cambios pendientes

### Requirement: Caché limitada sin pérdida persistida
El sistema SHALL expulsar vectores por LRU al exceder el presupuesto y SHALL recargar las mismas filas al necesitarlas.

#### Scenario: Consultar una sesión expulsada
- **WHEN** vuelve a buscarse esa sesión
- **THEN** la búsqueda recarga sus vectores y conserva sus resultados
