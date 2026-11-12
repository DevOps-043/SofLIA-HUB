## ADDED Requirements

### Requirement: Acceso con identidad de organización
El menú MUST mostrar el logo de la organización activa sin foto personal ni nombre visible duplicado y MUST mantener su nombre accesible.

#### Scenario: Abrir el menú
- **WHEN** existe una organización activa y se pulsa su logo con la barra expandida, compacta o inferior
- **THEN** se abre el menú con sus acciones y el selector conserva los nombres de las organizaciones.

### Requirement: Selección y recuperación del logo
El menú MUST intentar `logo_url`, después `brand_favicon_url` y finalmente la inicial de la organización, sin sustituir su identidad por la foto de la persona.

#### Scenario: Empresa con logo sin favicon
- **WHEN** la organización solo tiene `logo_url`
- **THEN** el acceso y la fila del selector muestran ese logo.

#### Scenario: Imagen no disponible
- **WHEN** el logo falla al cargar
- **THEN** se intenta el favicon y, si también falla o falta, se muestra la inicial sin imagen rota.

#### Scenario: Cambiar de organización
- **WHEN** cambia la organización activa o sus URLs
- **THEN** se intentan sus imágenes sin conservar errores de la identidad anterior.

### Requirement: Imagen proporcional sin marco
Las imágenes MUST mantenerse completas y proporcionales, sin recorte circular ni fondo, borde o sombra añadidos.

#### Scenario: Logos altos y horizontales
- **WHEN** se presenta una imagen vertical u horizontal en tema claro u oscuro
- **THEN** cabe en el espacio disponible mediante ajuste proporcional y no se muestra dentro de una caja decorativa.
