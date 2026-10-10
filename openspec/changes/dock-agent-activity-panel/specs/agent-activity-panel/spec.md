## ADDED Requirements

### Requirement: Panel de equipos acoplado
El sistema SHALL mostrar la actividad de los equipos de agentes en un panel dentro de la ventana principal, en el Hub y en el navegador integrado, sin abrir ventanas adicionales.

#### Scenario: Equipo nuevo
- **WHEN** comienza un equipo que el panel no conocía
- **THEN** el panel se despliega una vez y muestra canal, roles y estados

#### Scenario: Ocultar durante el trabajo
- **WHEN** el usuario oculta el panel y el mismo equipo publica actualizaciones
- **THEN** el panel permanece oculto, el trabajo continúa y el botón lo recupera

### Requirement: Convivencia con el navegador
En el navegador integrado, el panel MUST quedar bajo la barra de pestañas y su ancho MUST descontarse de la vista nativa de la página, también cuando el chat flotante ocupa el mismo lado.

#### Scenario: Chat y panel a la derecha
- **WHEN** el chat flotante se mueve a la derecha con el panel abierto
- **THEN** el chat se coloca junto al panel y ninguno queda bajo la página

#### Scenario: Controles de la barra
- **WHEN** el navegador está abierto
- **THEN** el acceso al panel forma parte de la barra de pestañas y no se superpone a sus controles

### Requirement: Superficie IPC mínima
Main MUST difundir la actividad sólo a la ventana del Hub y aceptar `snapshot` y `publish` únicamente desde los frames principales de Hub y Orbe; no expone canales para mostrar u ocultar vistas.

#### Scenario: Frame ajeno
- **WHEN** otra ventana o un subframe solicita un snapshot o publica actividad
- **THEN** la petición se rechaza sin exponer datos
