## ADDED Requirements

### Requirement: Continuidad del primer turno
El sistema SHALL conservar el controlador del turno y la respuesta pendiente al
persistir el primer mensaje, sin cambiar el ámbito reservado del chat.

#### Scenario: Primer guardado durante inferencia
- **WHEN** se envía el primer mensaje y el borrador recibe su identificador persistido
- **THEN** la señal del turno sigue activa, se muestra la espera y la respuesta aparece al finalizar

#### Scenario: Error del primer turno
- **WHEN** el proveedor rechaza el turno después del primer guardado
- **THEN** aparece el aviso de error y termina el indicador de espera

### Requirement: Revocación por ámbito real
El sistema SHALL cancelar el turno supervisado y limpiar el visor al cambiar de
chat, usuario u organización, sin publicar respuestas tardías en el nuevo ámbito.

#### Scenario: Otro borrador
- **WHEN** se abre un nuevo chat durante una respuesta pendiente
- **THEN** se aborta el turno anterior, se limpia el visor y no aparece su respuesta tardía

#### Scenario: Cambio de identidad
- **WHEN** cambia el usuario o la organización durante una respuesta pendiente
- **THEN** el ámbito nuevo no recibe el archivo ni el texto del ámbito anterior
