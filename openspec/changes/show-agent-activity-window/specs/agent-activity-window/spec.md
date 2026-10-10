## Purpose

Permitir al usuario observar equipos de agentes en una ventana auxiliar sin interrumpir su trabajo ni revelar el contenido de las solicitudes.

## ADDED Requirements

### Requirement: Monitor automático de especialistas
El sistema SHALL abrir sin robar foco una ventana auxiliar al iniciar un equipo y mostrar canal, roles y estados provenientes de eventos reales.

#### Scenario: Trabajo paralelo
- **WHEN** dos especialistas trabajan y uno termina primero
- **THEN** el monitor muestra sus estados diferentes y actualiza el equipo sin polling

### Requirement: Control visual independiente
El usuario SHALL poder minimizar u ocultar el monitor sin cancelar el trabajo y volver a abrirlo desde el Hub.

#### Scenario: Ocultar durante análisis
- **WHEN** el usuario oculta el monitor
- **THEN** los especialistas continúan y su estado se recupera al reabrirlo

### Requirement: Aislamiento y datos mínimos
El monitor MUST recibir sólo metadatos acotados, rechazar IPC de frames no autorizados y limpiar datos al cambiar sesión.

#### Scenario: Cambio de usuario
- **WHEN** la sesión cambia mientras un equipo anterior continúa
- **THEN** se destruye la vista anterior y sus eventos tardíos no aparecen en la nueva sesión

#### Scenario: Fuente no autorizada
- **WHEN** otro frame intenta publicar o leer actividad
- **THEN** se rechaza la petición sin exponer snapshots
