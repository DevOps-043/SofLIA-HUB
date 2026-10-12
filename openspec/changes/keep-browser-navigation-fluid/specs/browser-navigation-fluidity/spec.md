## ADDED Requirements

### Requirement: Sugerencias con página viva
La barra SHALL mostrar las sugerencias sin capturar ni ocultar la página.
El viewport MUST reservar su espacio y restaurarse al cerrarlas.

#### Scenario: Escritura y selección de dirección
- **WHEN** aparecen sugerencias al editar la dirección
- **THEN** la página sigue visible debajo del desplegable y no se solicita captura

#### Scenario: Cierre o redimensionamiento
- **WHEN** se cierra, redimensiona o desmonta el desplegable
- **THEN** se publica únicamente la geometría vigente sin revivir una vista bajo un gestor

### Requirement: Zoom sin trabajo nativo repetido
El navegador MUST evitar reaplicar un zoom idéntico sobre el mismo documento.
SHALL reaplicarlo al cambiar factor, tamaño efectivo o documento.

#### Scenario: Alternar pestañas cargadas
- **WHEN** se activa repetidamente una pestaña sin cambio de zoom ni tamaño
- **THEN** no se reinicia la emulación de su superficie

#### Scenario: Navegación o recarga
- **WHEN** una pestaña carga un documento nuevo, incluso con la misma URL
- **THEN** aplica el zoom pendiente tras la carga y conserva las barreras de crash y carga
