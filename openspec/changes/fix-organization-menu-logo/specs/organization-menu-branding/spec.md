## ADDED Requirements

### Requirement: Acceso con identidad de organización
El menú MUST mostrar la imagen y el nombre visible de la organización activa en las barras expandidas e inferior, sin foto personal ni flecha. La barra compacta MUST conservar el nombre accesible. El área del menú MUST ser transparente y diferenciarse de los chats sólo mediante separador superior.

#### Scenario: Abrir el menú
- **WHEN** existe una organización activa y se pulsa su logo con la barra expandida, compacta o inferior
- **THEN** se abre el menú con sus acciones y el selector conserva los nombres de las organizaciones; el acceso expandido mantiene su nombre visible de 15 px incluso si falla el logo.

### Requirement: Selección y recuperación del logo
El menú MUST intentar `brand_logo_url`, después el logo heredado `logo_url`, luego `brand_favicon_url` y finalmente la inicial de la organización, sin sustituir su identidad por la foto de la persona.

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
