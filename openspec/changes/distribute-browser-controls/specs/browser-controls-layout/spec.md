## ADDED Requirements

### Requirement: Atajos de teclado con el foco en la página
El navegador integrado SHALL ejecutar los atajos de Chrome definidos en la tabla compartida tanto con el foco en la página como en la barra del navegador, y MUST NOT interceptar las teclas del chat de SofLIA ni las del agente mientras controla la vista.

#### Scenario: Buscar desde la página
- **WHEN** el usuario pulsa Ctrl+F con el foco en la página
- **THEN** se abre la barra de búsqueda del navegador con el foco en su campo

#### Scenario: Atajo en el chat
- **WHEN** el usuario pulsa Ctrl+W escribiendo en el chat de SofLIA
- **THEN** ninguna pestaña se cierra

#### Scenario: Agente al mando
- **WHEN** el agente envía Ctrl+W a la página mientras controla la vista
- **THEN** la tecla llega a la página y no se cierra la pestaña

### Requirement: Zoom con Ctrl y la rueda
Ctrl+rueda SHALL ampliar o reducir el zoom de la pestaña activa con los mismos límites que los botones, también cuando Electron ofrece zoom aislado.

#### Scenario: Rueda hacia arriba
- **WHEN** el usuario gira la rueda hacia arriba con Ctrl pulsado sobre la página
- **THEN** el zoom de esa pestaña aumenta un paso y el menú refleja el porcentaje

### Requirement: Acciones de pestaña en la propia pestaña
Fijar, duplicar, silenciar, agrupar, mover a ventana, cerrar por alcance y reabrir SHALL ofrecerse en el menú contextual de la pestaña, y el silencio SHALL poder alternarse desde un icono en la pestaña cuando reproduce audio o está silenciada.

#### Scenario: Pestaña de fondo con audio
- **WHEN** una pestaña no activa reproduce audio y el usuario pulsa su icono de sonido
- **THEN** sólo esa pestaña queda silenciada y la pestaña activa no cambia

#### Scenario: Orden no reconocida
- **WHEN** llega por IPC una orden ajena a la tabla
- **THEN** el renderer la descarta sin ejecutar nada
