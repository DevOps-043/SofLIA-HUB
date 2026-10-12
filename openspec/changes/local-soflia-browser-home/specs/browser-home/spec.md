## ADDED Requirements

### Requirement: Inicio local en Chromium
El navegador MUST abrir la portada local SofLIA al iniciar sin URL, crear una
pestaña sin destino y reemplazar la última pestaña cerrada.

#### Scenario: Inicio sin conexión
- **WHEN** se abre una pestaña nueva sin destino
- **THEN** Chromium muestra el logo y el buscador sin solicitudes remotas

#### Scenario: Continuidad del documento
- **WHEN** se recarga, reabre o restaura una pestaña de inicio
- **THEN** la portada reaparece y la barra conserva el placeholder de búsqueda

### Requirement: Diseño accesible y ligero
La portada MUST compartir los tokens claro/oscuro y seguir el tema de la app.
Sus animaciones MUST respetar movimiento reducido sin bucles JavaScript.

#### Scenario: Cambio de tema
- **WHEN** la preferencia de la aplicación cambia de claro a oscuro
- **THEN** la portada abierta actualiza sus colores sin recargar el documento

#### Scenario: Búsqueda por teclado
- **WHEN** se escribe una búsqueda y se presiona Enter
- **THEN** se navega hacia Google mediante los controles de seguridad existentes

### Requirement: Recursos internos acotados
El documento MUST permanecer sin Node, preload ni scripts y el nuevo esquema
MUST aceptar exclusivamente la URL de inicio canónica.

#### Scenario: Ruta interna manipulada
- **WHEN** se solicita otro host, ruta, fragmento, query o credenciales
- **THEN** se rechaza sin servir archivos locales ni habilitar protocolos externos
