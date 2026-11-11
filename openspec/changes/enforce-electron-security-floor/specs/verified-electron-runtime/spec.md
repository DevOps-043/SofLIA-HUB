## Purpose

Mantener un runtime Electron verificable con las mitigaciones de seguridad publicadas y rechazar checkouts que regresen a versiones conocidas como afectadas antes de su entrega.

## ADDED Requirements

### Requirement: Runtime fuera de rangos afectados conocidos
La verificación de Soflia Hub MUST rechazar versiones exactas de Electron incluidas en los rangos publicados de GHSA-jr5w-w6x2-84p9. MUST rechazar versiones ausentes o inverificables y mantener la validación de estabilidad.

#### Scenario: Regresión a versión estable afectada
- **WHEN** el checkout fija una versión estable dentro del rango afectado
- **THEN** la compuerta de PR falla e identifica la política de seguridad incumplida

#### Scenario: Excepción temporal de beta
- **WHEN** existe una excepción válida para un prerelease todavía afectado
- **THEN** la verificación sigue fallando por seguridad aunque la excepción satisfaga estabilidad

### Requirement: Concordancia del runtime usado
La verificación MUST exigir concordancia entre versión declarada, resuelta, paquete físico y versión del ejecutable; MUST NOT tratar un lock actualizado como prueba de actualización del binario.

#### Scenario: Ejecutable anterior
- **WHEN** el lock ya declara una versión parcheada pero el ejecutable emite otra
- **THEN** la verificación falla antes de dar por válido el checkout

### Requirement: Evidencia proporcional de actualización
La entrega MUST distinguir incorporación del parche publicado, regresiones locales y certificación remota o de instalador. MUST preservar API/IPC, perfiles y permisos de los consumidores existentes.

#### Scenario: Smokes locales aprobados
- **WHEN** se ejecutan regresiones con el runtime nuevo en perfiles temporales
- **THEN** la evidencia identifica runtime y alcance sin afirmar reproducción MITM, pruebas remotas o actualización de instalaciones desplegadas
