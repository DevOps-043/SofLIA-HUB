## ADDED Requirements

### Requirement: Controlar la ventana sin iniciar sesión

La pantalla de acceso SHALL mostrar la barra de título compartida con los
controles de minimizar, maximizar/restaurar y cerrar, independientes de la
autenticación y del envío del formulario.

#### Scenario: Pantalla de acceso sin sesión

- **WHEN** se muestra el formulario de acceso en la ventana principal
- **THEN** aparece una única barra superior con los tres controles de ventana
- **AND** su región libre permite arrastrar la ventana y los botones son clicables

#### Scenario: Acciones de ventana antes de autenticar

- **WHEN** se pulsa minimizar o cerrar desde el acceso
- **THEN** se invoca la API de ventana existente sin enviar el formulario

#### Scenario: Maximizar y volver al modo ventana

- **WHEN** se pulsa maximizar y posteriormente restaurar
- **THEN** se alterna el estado nativo y la etiqueta refleja el estado actual

#### Scenario: Cambio nativo del tamaño

- **WHEN** la ventana cambia entre maximizada y restaurada mediante el sistema
- **THEN** el control actualiza su etiqueta al recibir el evento de tamaño

### Requirement: Mantener accesible el formulario

La barra de título SHALL permanecer encima del contenido desplazable. La tarjeta
SHALL centrarse en el espacio restante cuando cabe y permitir desplazamiento
vertical cuando su altura supera el espacio disponible.

#### Scenario: Ventana de poca altura

- **WHEN** el contenido del acceso supera el espacio debajo de la barra
- **THEN** el formulario puede desplazarse y los controles siguen visibles
