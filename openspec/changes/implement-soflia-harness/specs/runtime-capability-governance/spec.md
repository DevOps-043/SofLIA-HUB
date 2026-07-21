## ADDED Requirements

### Requirement: Separación entre desarrollo y runtime
El sistema MUST tratar las skills de desarrollo y las capacidades runtime como
dominios separados y MUST NOT convertir instrucciones Markdown en permisos de ejecución.

#### Scenario: Se registra una skill de desarrollo
- **WHEN** la skill aparece en `ai-specs/skills/`
- **THEN** ningún agente runtime obtiene esa capacidad de forma automática

### Requirement: Denegación por defecto
Toda capacidad runtime futura MUST declarar esquema, propietario, nivel de riesgo,
política HITL, allowlist y auditoría antes de habilitarse.

#### Scenario: Falta metadato de seguridad
- **WHEN** una capacidad no declara uno de los controles obligatorios
- **THEN** el registro ejecutable rechaza su activación

### Requirement: Acciones críticas con HITL
Las acciones destructivas, envíos, ejecución arbitraria, despliegues y acceso a
secretos MUST requerir aprobación humana explícita y contextual.

#### Scenario: El modelo solicita una acción crítica
- **WHEN** no existe aprobación válida para el actor, objetivo y operación actuales
- **THEN** el adaptador no ejecuta la acción y devuelve una solicitud de confirmación segura

### Requirement: Restricciones de grupo de WhatsApp
El agente de WhatsApp MUST mantener bloqueadas en grupos las herramientas de
escritura, borrado, shell, portapapeles y control del sistema.

#### Scenario: Un grupo solicita escritura local
- **WHEN** una conversación grupal intenta invocar una capacidad bloqueada
- **THEN** el sistema deniega la llamada y registra el motivo sin exponer secretos
