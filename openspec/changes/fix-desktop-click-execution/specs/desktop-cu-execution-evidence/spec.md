## ADDED Requirements

### Requirement: Efectos de entrada comprobables
El sistema SHALL ejecutar la entrada solicitada o devolver un error, sin ignorar acciones o teclas desconocidas.

#### Scenario: Escritura dirigida
- **WHEN** el modelo pide escribir en una coordenada
- **THEN** enfoca ese punto antes de introducir texto

#### Scenario: Acción no disponible
- **WHEN** llega una acción no soportada por el backend
- **THEN** reporta el rechazo y no la cuenta como operación exitosa

#### Scenario: Fallo antes de escribir en un lote
- **WHEN** abrir la aplicación falla y quedan acciones de escritura en la misma respuesta
- **THEN** omite esas acciones, comunica sus resultados de rechazo y consulta de nuevo al proveedor

### Requirement: Finalización basada en evidencia
El sistema SHALL impedir un cierre exitoso con errores pendientes y corroborar la meta de escritorio con observación reciente.

#### Scenario: Texto después de un clic fallido
- **WHEN** el ejecutor rechaza el clic y el modelo responde Listo
- **THEN** el resultado es fallido y no anuncia la tarea como completada

#### Scenario: Pantalla sin resultado
- **WHEN** se propone completar una tarea y la verificación no confirma la meta
- **THEN** conserva el progreso real y devuelve una tarea no completada
