## Purpose

Evitar efectos nuevos de decisiones revocadas en los backends web/UIA y
recuperar su disponibilidad después de fallos de inicio o finalización.

## ADDED Requirements

### Requirement: Vigencia entre etapas
El sistema SHALL revisar cancelación después de esperar decisiones y antes
de iniciar la siguiente llamada controlada de una acción compuesta.
#### Scenario: Modelo devuelve una acción tras cancelar
- **WHEN** el modelo pendiente termina después de revocar la tarea
- **THEN** el backend no inicia esa acción ni un modelo alternativo
#### Scenario: Cancelación entre efectos de una acción compuesta
- **WHEN** una acción es revocada después de su primera llamada
- **THEN** no inicia las siguientes llamadas controladas ni un fallback

### Requirement: Limpieza ante fallos
El sistema SHALL retirar listeners y recuperar estado/cola aunque falle
la publicación inicial o el finalizador de artefactos.
#### Scenario: Fallo de inicio o finalizador
- **WHEN** un consumidor inicial o el finalizador rechaza la operación
- **THEN** la tarea termina con error y la plaza no queda ocupada indefinidamente

### Requirement: Cancelación conserva límites
El sistema SHALL conservar HITL, contratos y éxito legítimo; una cancelación
no inicia una captura final adicional ni se presenta como reversión de efectos.
#### Scenario: Captura final después de cancelar
- **WHEN** la tarea cancelada llega a finalización sin captura previa
- **THEN** no toma una captura nueva y conserva la limpieza de recursos iniciados
