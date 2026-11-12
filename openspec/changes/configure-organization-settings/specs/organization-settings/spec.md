## ADDED Requirements

### Requirement: Administración de identidad
El sistema MUST ofrecer Organización en Ajustes sólo a propietarios o administradores activos de la organización seleccionada y MUST volver a autorizar en servidor cada lectura o escritura.

#### Scenario: Usuario sin privilegios
- **WHEN** un miembro, invitado, suspendido o usuario de otra organización intenta acceder
- **THEN** el formulario no está disponible y la RPC deniega el acceso sin modificar datos.

### Requirement: Edición básica con guardado explícito
El administrador MUST poder configurar nombre, descripción, contacto, web, logo, icono y colores con validación, vista previa y acción Guardar.

#### Scenario: Guardar cambios
- **WHEN** el administrador guarda datos válidos
- **THEN** se persisten sólo los campos autorizados y el menú actualiza la imagen y nombre sin reiniciar.

#### Scenario: Cambio de ámbito o fallo remoto
- **WHEN** cambia el usuario/organización durante una petición o falla la red/despliegue
- **THEN** no se aplica una respuesta tardía a otra sesión y se informa el error con reintento sin afirmar éxito.

### Requirement: Acceso flotante
El acceso inferior MUST mostrar imagen y nombre mayor, sin flecha ni fondo distinto al de los chats, separado sólo por una línea.

#### Scenario: Imagen no disponible
- **WHEN** no puede cargarse la imagen
- **THEN** se conserva el nombre visible y no se utiliza la foto personal como identidad de la organización.
