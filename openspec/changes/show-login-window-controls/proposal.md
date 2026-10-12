# Controles de ventana en el acceso

La ventana principal de Electron no tiene marco nativo. `AuthChrome` muestra el
formulario de acceso sin la barra de título que ya usa el espacio autenticado,
por lo que faltan minimizar, maximizar/restaurar y cerrar antes de iniciar sesión.

Se reutiliza `AppTitleBar` encima del formulario, con su región de arrastre y
`WindowControls`. La tarjeta permanece centrada en el espacio disponible y puede
desplazarse verticalmente cuando la ventana es pequeña.

No cambia autenticación, IPC, datos, permisos ni empaquetado. La animación de
arranque y la ventana de la orbe conservan su comportamiento.
