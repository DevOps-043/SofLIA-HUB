## ADDED Requirements

### Requirement: Objetivo de concurrencia medible

El sistema SHALL expresar la meta de usuarios concurrentes como un RNF medible
con usuarios simultáneos objetivo, mezcla de operaciones representativa,
percentiles de latencia (p95/p99) y tasa de error aceptable, registrado en la
documentación de parámetros de runtime. El sistema MUST NOT declarar cumplimiento
de esa meta sin una prueba de carga ejecutada que lo respalde.

#### Scenario: Meta convertida en RNF

- **WHEN** se documenta la capacidad de concurrencia del Hub
- **THEN** existe un RNF con cifras objetivo y umbrales medibles, no una promesa
  cualitativa

#### Scenario: Afirmación sin evidencia

- **WHEN** no se ha ejecutado la prueba de carga del escenario definido
- **THEN** el sistema describe la meta como objetivo pendiente de verificación y
  no como capacidad demostrada

### Requirement: Escenario de carga reproducible

El sistema SHALL definir un escenario de carga reproducible con perfil de
tráfico, datos de siembra y procedimiento de ejecución que un operador pueda
correr contra un entorno de medición. La ejecución de la prueba y de cualquier SQL
remoto MUST requerir autorización explícita y HITL, y su resultado MUST
registrarse fuera del repositorio.

#### Scenario: Escenario ejecutable por un operador

- **WHEN** un operador toma el escenario definido
- **THEN** puede reproducir la carga con el perfil y los datos de siembra
  descritos sin reconstruir decisiones

#### Scenario: Ejecución remota gobernada

- **WHEN** se requiere ejecutar SQL remoto o la prueba de carga
- **THEN** ocurre solo con autorización explícita y HITL, y su evidencia se
  registra fuera del repositorio

### Requirement: Índices auditados y suficientes

El sistema SHALL verificar por instancia que las migraciones de rendimiento
existentes estén aplicadas y que sus índices cubran las consultas calientes según
planes reales, y MUST entregar los índices faltantes como migraciones idempotentes
con rollback justificadas por consulta, sin sobreindexar escrituras.

#### Scenario: Índice existente aplicado y usado

- **WHEN** se audita una consulta caliente cubierta por un índice existente
- **THEN** la evidencia del plan confirma que el índice está aplicado y se usa

#### Scenario: Índice faltante

- **WHEN** una consulta caliente carece de un índice adecuado
- **THEN** se propone una migración idempotente con rollback y justificación, sin
  aplicarla remotamente sin autorización

### Requirement: RLS eficiente que preserva aislamiento

El sistema SHALL auditar las políticas RLS que reevalúan funciones de auth por
fila en tablas calientes y MUST proponer la forma escalable manteniendo el
aislamiento por actor, organización u ownership; una política permisiva no cuenta
como aislamiento.

#### Scenario: Política reescrita sin perder aislamiento

- **WHEN** se envuelve la función de auth en subconsulta para evaluarla una vez
- **THEN** SELECT, INSERT, UPDATE y DELETE siguen restringidos al actor y
  ownership correctos

#### Scenario: Aislamiento verificado

- **WHEN** se prueba el acceso con un actor equivocado
- **THEN** la política deniega el acceso pese al cambio de rendimiento

### Requirement: Patrones de consulta del cliente acotados

El sistema SHALL acotar columnas, paginar y limitar payloads en las consultas del
cliente donde la evidencia lo justifique, preservando el contrato de lectura del
renderer, y MUST asegurar el cierre de canales realtime y su viabilidad al
objetivo de concurrencia.

#### Scenario: Lectura acotada compatible

- **WHEN** una consulta con `select('*')` sin paginación se ajusta a columnas y
  límites
- **THEN** el renderer sigue recibiendo los campos que consume y la lectura queda
  paginada

#### Scenario: Realtime cerrado y viable

- **WHEN** una suscripción realtime deja de necesitarse o no escala al objetivo
- **THEN** el canal se cierra correctamente y, si la evidencia lo exige, se
  degrada a polling acotado con intervalo y cancelación
