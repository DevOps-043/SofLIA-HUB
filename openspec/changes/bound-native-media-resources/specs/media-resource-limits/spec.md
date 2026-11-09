## ADDED Requirements

### Requirement: Recursos físicos limitados
El servicio SHALL admitir como máximo cuatro subidas físicas concurrentes.
#### Scenario: Sesión invalidada con I/O pendiente
- **WHEN** cambia sesión mientras el proveedor no termina
- **THEN** las plazas siguen ocupadas y los resultados anteriores no se publican
#### Scenario: Uso secuencial de credenciales
- **WHEN** se realizan operaciones con claves
- **THEN** el servicio no mantiene un mapa de clientes indexado por clave

#### Scenario: Fallo tardío de una sesión revocada
- **WHEN** falla una subida o termina su cancelación después de invalidar sesión
- **THEN** el resultado se rechaza sin recrear registros de la sesión anterior
