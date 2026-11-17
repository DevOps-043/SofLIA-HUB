## ADDED Requirements

### Requirement: Preparación sin intervención técnica
La app MUST preparar Python privado y el modelo español pequeño automáticamente
sin pedir comandos al usuario y MUST compartir instalaciones simultáneas.
Preparar dependencias MUST NOT iniciar captura. Una activación MUST esperar
preparación y revalidar sesión, documento y cancelación antes de capturar.

#### Scenario: Primer uso sin dependencias
- **WHEN** faltan Python o Vosk al iniciar la app o activar voz
- **THEN** se preparan automáticamente, se muestra su estado y sólo se captura
  con consentimiento y contexto vigentes

#### Scenario: Preparación fallida o cancelada
- **WHEN** falla la red o se cancela/cambia sesión durante la preparación
- **THEN** no se captura audio, el error es controlado y se puede reintentar

### Requirement: Recordar consentimiento explícito
La aprobación MUST poder reutilizarse para la misma cuenta y configuración en
este equipo. MUST NOT derivarse de enabled ni aplicarse a otra cuenta/configuración.
Detener/deshabilitar MUST revocar la aprobación recordada de la cuenta actual.

#### Scenario: Regreso a una configuración aprobada
- **WHEN** la misma cuenta vuelve a activar una configuración explícitamente aprobada
- **THEN** no aparece otro diálogo de autorización

#### Scenario: Cuenta o configuración distinta
- **WHEN** no existe aprobación explícita correspondiente o cambió la configuración
- **THEN** se requiere confirmación antes de capturar
