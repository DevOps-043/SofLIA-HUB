## Purpose

Permite que SofLIA escuche, durante un intervalo acotado y bajo una petición explícita del usuario, el audio del sistema o del micrófono del equipo para responder sobre lo que está sonando, sin convertirse en una escucha continua ni persistente.

## ADDED Requirements

### Requirement: Escucha explícita y acotada

El sistema SHALL iniciar la captura de audio para el chat únicamente tras una petición explícita del usuario en ese turno, MUST detenerla al alcanzar el límite de duración configurado y MUST no iniciarla de forma autónoma por decisión del modelo.

#### Scenario: Escucha solicitada por el usuario

- **WHEN** el usuario pide a SofLIA escuchar lo que está sonando y concede el permiso correspondiente
- **THEN** el sistema captura audio durante el intervalo acotado, lo adjunta al turno y detiene la captura al terminar

#### Scenario: Límite de duración alcanzado

- **WHEN** la captura alcanza la duración máxima configurada sin que el usuario la detenga
- **THEN** el sistema detiene la captura, conserva lo capturado hasta ese punto y lo declara en el resultado

#### Scenario: Modelo intenta iniciar la escucha sin petición del usuario

- **WHEN** el modelo invoca la escucha sin que el turno contenga una petición explícita del usuario
- **THEN** el sistema no captura audio y devuelve un resultado de herramienta que declara la falta de autorización

### Requirement: Selección y disponibilidad de la fuente

El sistema SHALL permitir elegir entre el audio del sistema y el micrófono, y MUST declarar la degradación cuando la fuente solicitada no esté disponible en la plataforma.

#### Scenario: Audio del sistema disponible

- **WHEN** el usuario pide escuchar lo que suena en el equipo y la plataforma admite la captura de salida
- **THEN** el sistema captura la salida de audio del equipo y lo declara como fuente en el resultado

#### Scenario: Audio del sistema no disponible

- **WHEN** la plataforma no admite la captura de la salida de audio
- **THEN** el sistema informa que esa fuente no está disponible, ofrece capturar el micrófono y no sustituye la fuente en silencio

#### Scenario: Permiso del sistema operativo denegado

- **WHEN** el sistema operativo deniega el permiso de micrófono o de captura
- **THEN** el sistema informa la denegación y su origen, y el turno continúa sin audio en lugar de fallar de forma opaca

### Requirement: Indicador visible y detención por el usuario

El sistema SHALL mostrar un indicador visible mientras la captura está activa y MUST permitir al usuario detenerla en cualquier momento desde ese indicador.

#### Scenario: Indicador durante la captura

- **WHEN** la captura de audio para el chat está activa
- **THEN** la interfaz muestra un indicador persistente con la fuente capturada y el tiempo transcurrido

#### Scenario: Detención explícita

- **WHEN** el usuario detiene la captura desde el indicador
- **THEN** el sistema cierra la captura de inmediato y adjunta al turno únicamente el audio capturado hasta ese instante

#### Scenario: Cierre de la aplicación o pérdida del dispositivo

- **WHEN** la aplicación se cierra o el dispositivo de captura desaparece durante la escucha
- **THEN** el sistema libera la captura sin dejar el dispositivo tomado y declara la interrupción

### Requirement: No persistencia del audio capturado

El sistema SHALL retener el audio capturado únicamente durante el turno que lo consume y MUST no escribirlo en almacenamiento persistente ni incorporarlo al historial de la conversación como archivo recuperable.

#### Scenario: Turno resuelto

- **WHEN** el turno que consumió el audio capturado termina
- **THEN** el sistema descarta el audio del equipo y, si fue subido al proveedor, no conserva la referencia más allá de su caducidad

#### Scenario: Turno abortado

- **WHEN** el usuario cancela el turno antes de que se resuelva
- **THEN** el sistema descarta el audio capturado y cancela cualquier subida en curso
