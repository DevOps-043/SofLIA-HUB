## Purpose

Mantener cada petición, evento y fallo de los sidecars Python ligado al proceso que lo produce, con arranque, cierre y transporte acotados para voz y documentos.

## ADDED Requirements

### Requirement: Propiedad de proceso
El sistema MUST impedir que stdout/error/exit de un hijo retirado alteren estado, respuestas o sesiones del hijo actual. MUST conservar contratos públicos y separación de procesos de voz/documentos.

#### Scenario: Salida tardía del proceso anterior
- **WHEN** termina o emite datos un hijo retirado después de iniciar otro
- **THEN** las peticiones/eventos/estado del nuevo hijo permanecen vigentes

### Requirement: Arranque comprobado
Todos los consumidores concurrentes MUST esperar el mismo ready de versión compatible antes de enviar comandos. Fallo, timeout o salida anterior a ready MUST retirar la generación y limpiar sus esperas.

#### Scenario: Dos peticiones durante arranque
- **WHEN** se solicitan operaciones simultáneas antes del ready
- **THEN** sólo se lanza un hijo y ninguna operación se envía antes del ready compatible

### Requirement: Cierre sin resurrección
Stop MUST invalidar operaciones anteriores y reinicios pendientes antes de esperar cierre. MUST NOT restaurar escucha por respuestas o timers anteriores a stop; nuevos arranques explícitos esperan el cierre pendiente.

#### Scenario: Parar durante arranque o backoff
- **WHEN** se detiene el servicio con arranque o reinicio pendiente
- **THEN** se liberan las peticiones y no se reactiva escucha por esa intención antigua

#### Scenario: El SO no confirma terminación
- **WHEN** no se confirma kill de un hijo existente
- **THEN** se informa cierre no confirmado y se bloquea su reemplazo hasta observar close, sin confundirlo con un spawn sin PID

### Requirement: Recursos y resultados controlados
El transporte MUST acotar framing UTF-8, salida pendiente, payload y número/plazo de requests. MUST rechazar protocolo inválido sin contenido crudo en logs ni repetir comandos. Un chunk ya aceptado por stdin MUST NOT interpretarse como no aceptado por backpressure.

#### Scenario: Frame inválido o demasiado grande
- **WHEN** se recibe NDJSON incompatible/malformado o se excede el límite de línea
- **THEN** falla sólo esa generación, limpia sus recursos y devuelve error controlado

#### Scenario: Cola agotada
- **WHEN** se supera el presupuesto de stdin o requests
- **THEN** rechaza antes de escribir sin truncar, duplicar ni modificar el proceso hermano
