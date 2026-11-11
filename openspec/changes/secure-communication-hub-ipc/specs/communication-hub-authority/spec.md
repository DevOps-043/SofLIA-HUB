## Purpose

Proteger los diez contratos de Communication Hub mediante identidad nativa,
validación acotada, aprobación verificable y respuestas de alcance autorizado.

## ADDED Requirements

### Requirement: Actor nativo y fuente vigente
El sistema SHALL derivar usuario/organización en main y validar cada llamada.
#### Scenario: Actor falso o fuente ajena
- **WHEN** un cliente aporta otro actor o llama desde un documento no autorizado
- **THEN** no se consulta el servicio ni se produce un efecto
#### Scenario: Cambio durante espera
- **WHEN** cambia sesión/documento/selección organizacional, incluso A/B/A
- **THEN** se rechazan publicaciones y efectos posteriores de esa operación

### Requirement: Contrato acotado y autorización
El sistema SHALL validar campos, tipos y tamaños y exigir principal SOFIA activo en IPC.
#### Scenario: Array con apariencia de enum
- **WHEN** se aporta un array cuyo String coincide con proveedor, scope, acción o enum OpenAI
- **THEN** el validador JSON exige string real y rechaza sin conceder capacidades
#### Scenario: Perfil no disponible
- **WHEN** falla SOFIA o devuelve otra identidad
- **THEN** no se eleva a principal legacy y la respuesta pública no filtra el error

### Requirement: HITL y privacidad
El sistema SHALL confirmar el snapshot de cambios críticos y acotar datos leídos.
#### Scenario: Aprobación cancelada o tardía
- **WHEN** se cancela o revoca durante aprobación
- **THEN** no se envía/programa ni se cambia configuración/política
#### Scenario: Historial mixto
- **WHEN** un administrador consulta identidades e historial de su organización
- **THEN** no recibe registros de otras organizaciones ni mensajes personales ajenos ni historial físico sin propietario acreditado
