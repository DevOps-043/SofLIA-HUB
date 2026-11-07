## Purpose

Evitar que restauraciones y eventos de sesión superados restauren datos de identidad anteriores o inicien nuevas etapas de recuperación de conversaciones.

## ADDED Requirements

### Requirement: Prevalencia del evento vigente

El ciclo de restauración y eventos Auth MUST descartar resultados, errores y denegaciones de operaciones superadas o de un proveedor desmontado.

#### Scenario: Lectura inicial tardía
- **WHEN** llega un evento de cierre o de otra sesión antes de completar la lectura inicial
- **THEN** la lectura inicial no reemplaza estado, finaliza carga ajena ni inicia recuperación posterior

#### Scenario: Resolución anterior a A/B/A
- **WHEN** cambia la sesión y vuelve al mismo sujeto mientras espera una resolución anterior
- **THEN** la operación anterior sigue invalidada aunque coincida el sujeto

#### Scenario: Desmontaje
- **WHEN** se desmonta el proveedor con una operación pendiente
- **THEN** libera su suscripción y descarta las continuaciones pendientes

#### Scenario: Lia tarda o el correo del perfil quedó desactualizado
- **WHEN** se acepta una sesión Auth SOFIA para el sujeto vigente y Lia aún no responde
- **THEN** el renderer publica a main el par de tokens SOFIA ya aceptado
- **AND** la recuperación Lia usa el correo de la sesión Auth SOFIA para comprobar la identidad devuelta

#### Scenario: Main rechaza una publicación de la sesión vigente
- **WHEN** main rechaza la publicación positiva o se interrumpe su transporte
- **THEN** el renderer reintenta como máximo dos veces
- **AND** cancela los intentos pendientes al cambiar la publicación o revocar la sesión

### Requirement: Cancelación propagada de la recuperación

Una recuperación Lia iniciada por este ciclo MUST comprobar vigencia antes de iniciar pasos posteriores y antes de publicar resultados; una cancelación MUST conservar el estado de la sesión nueva sin degradarlo.

#### Scenario: Cancelación durante lectura o canje
- **WHEN** se cancela mientras espera lectura, refresh, canje u OTP
- **THEN** descarta la respuesta y no inicia el siguiente efecto, reconocimiento de perfil o publicación local

#### Scenario: Cancelación durante reintento
- **WHEN** se cancela durante la espera de un fallo transitorio
- **THEN** finaliza la espera y no reintenta ni registra degradación de la sesión nueva

#### Scenario: Operación vigente
- **WHEN** la operación permanece vigente
- **THEN** conserva la recuperación, validación de correo, degradación recuperable y denegación de membresía existentes

### Requirement: Límites de la garantía

La implementación MUST distinguir descarte de una continuación de revocación de un efecto SDK o remoto ya enviado y mantener los contratos de autorización del servidor.

#### Scenario: Efecto enviado antes de cancelar
- **WHEN** termina una llamada SDK que ya se había enviado
- **THEN** descarta sus continuaciones sin afirmar que revirtió su efecto o verificó RLS/JWT
