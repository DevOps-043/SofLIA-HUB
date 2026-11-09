## Purpose

Mantener la captura local y los datos de voz dentro de la sesión, consentimiento y ventanas autorizadas, cerrando entradas de ajustes, Orbe y restauración sin desconectar sus consumidores.

## ADDED Requirements

### Requirement: Caller y contrato de voz
Las operaciones MUST validar ventana/rol, marco, documento, sesión, aridad y schemas antes de consultar servicios o efectuar cambios. MUST NOT confiar en campos de aprobación ni convertir una selección inválida en default.

#### Scenario: Emisor o payload ajeno
- **WHEN** la llamada llega sin sesión/ventana válidas, de un subframe/documento ajeno o con payload fuera de contrato
- **THEN** falla sin captura, escritura, descarga ni solicitud a proveedor

### Requirement: Consentimiento hasta el comando nativo
Capturar MUST requerir grant vigente en main y aprobación humana del alcance. Enabled guardado MUST NOT conceder permiso; restaurar tras login MUST solicitar aprobación antes de capturar. Detener/deshabilitar MUST revocar intención sin quedar bloqueado por confirmación pendiente.

#### Scenario: Restauración cancelada
- **WHEN** se restaura una preferencia enabled y se cancela la revisión
- **THEN** no se abre captura y queda disponible activar explícitamente la sesión

#### Scenario: Ruta alternativa
- **WHEN** ajustes, Orbe o un callback intentan iniciar captura sin grant
- **THEN** la guardia main impide el comando nativo

### Requirement: Invalidación de sesión
Logout/cambio A/B/A MUST revocar grants, detener captura y descartar datos/respuestas previas. Un efecto aprobado ya invocado MUST informar incertidumbre si su resultado no puede entregarse con contexto vigente, sin afirmar rollback o repetirlo.

#### Scenario: Identidad cambia durante aprobación o comando
- **WHEN** cambia la identidad o contexto durante espera
- **THEN** no se amplía la autorización ni se entrega resultado al usuario siguiente; captura se cancela y efectos ya iniciados se declaran apropiadamente

### Requirement: Datos dirigidos y mínimos
Dictado/audio MUST entregarse sólo al consumidor vigente propietario de la sesión/voz. El estado público MUST excluir rutas del host y errores libres. La síntesis remota MUST aplicar cancelación y cuota real de respuesta.

#### Scenario: Ventana ajena o voz reemplazada
- **WHEN** llega un evento anterior o existe otra ventana no propietaria
- **THEN** no recibe audio/texto de esa sesión y no se usa broadcast global

#### Scenario: Respuesta excesiva o tardía
- **WHEN** el proveedor supera cuota o se invalida el caller
- **THEN** se aborta la lectura y no se devuelve audio a un contexto distinto
