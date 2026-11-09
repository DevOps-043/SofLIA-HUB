## Purpose

Garantizar que la percepción del navegador sólo publica resultados del ciclo y
documento autorizados, aun cuando capturas nativas anteriores sigan pendientes.

## ADDED Requirements

### Requirement: Revocación de resultados pendientes
El sistema MUST descartar resultados y errores de percepción iniciados en un
ciclo revocado por pausa o cierre/cambio de sesión. Reactivar MUST NOT otorgar
vigencia retroactiva al trabajo anterior.

#### Scenario: Pausa y reactivación durante captura
- **WHEN** se pausa y reactiva mientras una captura anterior sigue pendiente
- **THEN** su resultado no publica caché ni satisface la nueva solicitud

#### Scenario: Fallo tardío de sesión anterior
- **WHEN** falla trabajo pendiente tras cambiar sesión o pausar/reactivar
- **THEN** no sobrescribe el error o estado del ciclo actual

### Requirement: Coalescencia y caché con documento vigente
El sistema MUST compartir una captura en curso únicamente para el mismo ciclo,
destino y documento vigentes. MUST conservar serialización física por tipo y
descartar resultados ante cambios de documento/perfil aunque URL se repita.

#### Scenario: Documento distinto con la misma URL
- **WHEN** un documento se reemplaza durante la captura y vuelve a la misma URL
- **THEN** no se publica ni reutiliza el resultado del documento anterior

#### Scenario: Solicitudes concurrentes del destino vigente
- **WHEN** varias solicitudes requieren la misma percepción del documento vigente
- **THEN** comparten el trabajo compatible sin aumentar capturas simultáneas

### Requirement: Guardas y cadencia conservadas
El sistema MUST comprobar autorización y documento sensible antes/después de
esperas y efectos; MUST conservar cadencias existentes y no leer DOM mediante
polling pasivo. Pausa/cierre MUST cancelar tareas programadas aún no iniciadas.

#### Scenario: Revocación durante comprobación de política
- **WHEN** cambia ciclo/documento mientras se espera autorización o sensibilidad
- **THEN** no se inicia captura o lectura DOM bajo la autorización anterior

#### Scenario: Percepción pasiva sin solicitud explícita
- **WHEN** se recibe un evento de navegación o interacción permitido
- **THEN** se conserva la captura pasiva acotada sin extracción DOM periódica

#### Scenario: Política del agente modificada durante captura pasiva
- **WHEN** se cambia la política mientras una captura permitida sigue pendiente
- **THEN** se invalida su autorización antes de esperar el guardado y su resultado no se publica
