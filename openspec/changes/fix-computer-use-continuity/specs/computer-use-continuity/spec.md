## ADDED Requirements

### Requirement: Panel de archivos pertinente
El sistema SHALL omitir actividades Computer Use sin artefactos del panel Archivos
y SHALL conservar los archivos reales y los trabajos de documentos existentes.

#### Scenario: Control de pantalla sin entregable
- **WHEN** comienza o termina una actividad `computer` sin artefactos
- **THEN** el panel permanece cerrado y no presenta una tarjeta vacía al abrirlo manualmente

#### Scenario: Archivo real desde Computer Use
- **WHEN** una actividad `computer` contiene artefactos reales
- **THEN** el panel permite acceder a esos archivos

### Requirement: Continuidad acotada de tareas autorizadas
El sistema SHALL continuar un cierre prematuro si la comprobación visual identifica
una transición segura pendiente, conservando conversación, destino, guardas y
presupuesto. SHALL limitar esa recuperación a dos intentos por loop.

#### Scenario: Launcher todavía cargando
- **WHEN** el modelo termina y la captura reciente muestra una descarga o carga transitoria recuperable
- **THEN** el actuador recibe la captura y continúa sin preguntar si el usuario desea esperar

#### Scenario: Bloqueo o cancelación
- **WHEN** falta autorización, acceso, evidencia segura, presupuesto o la tarea fue cancelada
- **THEN** el actuador se detiene sin repetir efectos ni afirmar éxito y explica el bloqueo concreto

#### Scenario: Resultado al último paso
- **WHEN** la última acción permitida alcanza la meta y la comprobación la confirma
- **THEN** el sistema informa completada sin ejecutar acciones adicionales
