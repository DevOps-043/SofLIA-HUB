## ADDED Requirements

### Requirement: Permisos locales en el compositor
El chat SHALL ofrecer **Aprobar por mí** y **Acceso completo** desde el menú `+`. Main SHALL exigir revisión explícita para conceder Acceso completo y para operaciones críticas. La revisión de Computer Use SHALL mostrarse dentro de SofLIA.

#### Scenario: Revocar la autorización
- **WHEN** cambia la sesión, se recarga la ventana o el usuario vuelve a Aprobar por mí
- **THEN** las siguientes operaciones revisables requieren aprobación de nuevo

### Requirement: Navegación y descargas verificables
El harness SHALL abrir y navegar en la pestaña integrada aunque el panel todavía esté cerrado. SHALL comprobar el estado de una descarga con el registro del navegador antes de tratarla como completa.

#### Scenario: Abrir la primera página de una tarea
- **WHEN** el chat navega a un destino autorizado con el panel cerrado
- **THEN** abre el panel, conserva el destino y devuelve una observación de la pestaña o un fallo explícito

#### Scenario: Transferencia en curso o interrumpida
- **WHEN** el navegador aún está descargando un archivo o lo marca como interrumpido
- **THEN** el resultado conserva el estado real y sólo incluye el destino final tras completarse
