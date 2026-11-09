## Purpose

Proteger la entrada renderer de Computer Use mediante autoridad nativa,
contratos comprobados y revisión de los efectos sobre el equipo y correo.

## ADDED Requirements

### Requirement: Fuente y revisión vigentes

El sistema SHALL admitir sólo el marco principal del documento Hub/Orbe
registrado y una sesión vigente, revalidando resultados y progresos.

#### Scenario: Llamada ajena o revocada
- **WHEN** una fuente ajena invoca un canal o cambia sesión/navegación durante espera
- **THEN** no se despacha si aún no comenzó ni se publica información tardía

### Requirement: Contrato por operación

El sistema SHALL validar cantidad/tipo/campos de argumentos y cuota UTF-8 sin
ejecutar getters, conservando las operaciones y opciones válidas.

#### Scenario: Payload inválido
- **WHEN** llegan tipos incorrectos, campos ajenos o datos fuera de cuota
- **THEN** se devuelve rechazo fijo sin despachar servicio ni mostrar diálogo

### Requirement: Aprobación ligada a efectos

El sistema SHALL pedir confirmación nativa del snapshot para operaciones con
efectos; un booleano o aprobación renderer no concede permiso al servicio.

#### Scenario: Cambiar argumentos o sesión durante revisión
- **WHEN** se modifica el objeto original o se revoca la sesión durante diálogo
- **THEN** sólo el snapshot mostrado puede admitirse y una revisión revocada no ejecuta

### Requirement: Trabajos físicos acotados

El sistema SHALL admitir como máximo un trabajo por emisor y cuatro globales,
sin liberar plaza mientras una ejecución física permanezca pendiente.

#### Scenario: Ejecución lenta y peticiones adicionales
- **WHEN** un servicio sigue pendiente aunque cambie la sesión
- **THEN** no se inicia otro trabajo de ese emisor ni se acumula una cola

### Requirement: Compatibilidad integrada

El sistema SHALL conservar servicio/handler/preload allowlist/wrapper, sin
permitir que la capability de aprobación local omita revisión de Desktop Agent.

#### Scenario: Preload actual y consumidores anteriores
- **WHEN** se usa el bridge actual o un cliente anterior sin capability
- **THEN** la revisión nativa protege efectos en ambos casos
