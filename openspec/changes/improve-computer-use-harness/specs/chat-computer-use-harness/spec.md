## ADDED Requirements

### Requirement: Permisos locales en el compositor
El chat SHALL ofrecer **Aprobar por mí** y **Acceso completo** desde el menú `+`. Aprobar por mí SHALL evaluar las acciones de bajo riesgo en main y pedir revisión para el resto. Acceso completo SHALL requerir autorización explícita al activarlo y reutilizar ese permiso en las operaciones locales de Computer Use, Desktop Agent y el navegador integrado sin pedir revisión por acción.

#### Scenario: Iniciar una tarea de escritorio
- **WHEN** el chat inicia una tarea de Desktop Agent con Acceso completo vigente
- **THEN** main valida la tarea y la ejecuta con la autorización de la ventana

#### Scenario: Política de navegador
- **WHEN** el navegador solicita acceso del agente a un sitio y el modo Acceso completo está vigente
- **THEN** se autoriza para esa sesión y se respetan los bloqueos configurados, los documentos sensibles y las políticas de la organización

#### Scenario: Revocar la autorización
- **WHEN** cambia la sesión, se recarga la ventana o el usuario vuelve a Aprobar por mí
- **THEN** las operaciones que sólo autorizaba Acceso completo vuelven a requerir aprobación

#### Scenario: Copia iniciada por el usuario
- **WHEN** la persona copia texto desde el chat
- **THEN** la interfaz usa el portapapeles del documento sin solicitar revisión de Computer Use

#### Scenario: Operación local ordinaria del agente
- **WHEN** Acceso completo está vigente y el agente copia texto o mueve un archivo local sin sobrescribir
- **THEN** main ejecuta la operación validada sin pedir una segunda aprobación

### Requirement: Identidad de mensajes editados
Guardar una edición SHALL actualizar el mensaje con su identidad original y descartar la rama posterior conocida que se regenera. El caché y la sincronización SHALL conservar la revisión y ocultar los mensajes de la rama reemplazada sin borrar registros ajenos al turno.

#### Scenario: Recarga con mensajes anteriores
- **WHEN** la sincronización devuelve una versión vieja del mensaje editado o mensajes de su rama anterior
- **THEN** la interfaz muestra una sola copia con el texto editado y conserva otros mensajes que no pertenecían al reemplazo

### Requirement: Navegación y descargas verificables
El harness SHALL abrir y navegar en la pestaña integrada aunque el panel todavía esté cerrado. SHALL comprobar el estado de una descarga con el registro del navegador antes de tratarla como completa.

#### Scenario: Abrir la primera página de una tarea
- **WHEN** el chat navega a un destino autorizado con el panel cerrado
- **THEN** abre el panel, conserva el destino y devuelve una observación de la pestaña o un fallo explícito

#### Scenario: Transferencia en curso o interrumpida
- **WHEN** el navegador aún está descargando un archivo o lo marca como interrumpido
- **THEN** el resultado conserva el estado real y sólo incluye el destino final tras completarse
