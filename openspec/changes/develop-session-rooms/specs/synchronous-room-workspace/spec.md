## ADDED Requirements

### Requirement: Preparación ajustable por actividad
El sistema MUST recibir instrucciones y metadatos opcionales de colaboración y permitir al instructor ajustar la distribución efectiva.

#### Scenario: Actividad en equipos
- **WHEN** el instructor selecciona una práctica con propuesta de tamaño
- **THEN** ve instrucciones, propuesta y una previsualización equilibrada antes de abrir
- **AND** puede cambiar tamaño o cantidad sin modificar la propuesta de Architect

#### Scenario: Autorización y compatibilidad
- **WHEN** un participante intenta administrar salas o el servidor no anuncia la ampliación
- **THEN** el servidor rechaza la administración o el cliente deshabilita la operación nueva respectivamente

### Requirement: Gestión persistida
El sistema MUST permitir nombres, asignaciones únicas, visitas y cierre mediante operaciones confirmadas de Learning.

#### Scenario: Reasignación
- **WHEN** el instructor cambia a una persona de sala
- **THEN** queda asignada a un solo destino y sale del contexto anterior
- **AND** no se aceptan instructores, usuarios bloqueados o destinos ajenos

### Requirement: Espacio de sala
El sistema MUST mostrar una galería central de personas presentes y dividir el lateral entre datos de la sala, actividad y chat del equipo. Los controles inferiores y las entregas personales se conservan.

#### Scenario: Galería y contexto audiovisual
- **WHEN** el participante o instructor entra en una sala
- **THEN** la galería muestra la llamada de esa sala cuando el SDK confirma el destino, con nombre y ficha para quienes tienen la cámara apagada
- **AND** mientras no se confirma la conexión, muestra únicamente la presencia académica de la sala, con un estado explícito de audio y video

#### Scenario: Trabajo y regreso
- **WHEN** un participante entra a su sala y después regresa al grupo principal
- **THEN** cada conversación conserva su contexto, los errores permiten reintentar y la llamada no se remonta al cambiar paneles

#### Scenario: Sala sin metadatos
- **WHEN** una sala anterior no tiene actividad vinculada
- **THEN** muestra integrantes y un estado de actividad pendiente sin inventar instrucciones ni tamaño de equipo
