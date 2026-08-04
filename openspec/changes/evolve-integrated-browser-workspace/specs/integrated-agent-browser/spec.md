## MODIFIED Requirements

### Requirement: Vista de navegador integrada
El sistema SHALL ofrecer a cada usuario autenticado un navegador dentro de un panel derecho del workspace de SofLIA con barra de dirección, atrás, adelante, recarga o detención, foco y estado de carga/error, sin reemplazar la única instancia del chat activo salvo cuando el usuario lo expanda a ancho completo.

#### Scenario: Navegación manual exitosa
- **WHEN** el usuario abre Navegador e introduce una URL HTTP(S) válida
- **THEN** el sistema muestra el sitio en el panel derecho y actualiza URL, título, carga e historial mientras el chat permanece disponible

#### Scenario: Búsqueda desde la barra
- **WHEN** el usuario introduce texto que no es una URL
- **THEN** el sistema navega a una búsqueda HTTPS con el texto codificado

#### Scenario: Error de navegación
- **WHEN** la carga principal falla
- **THEN** la barra conserva un estado observable con mensaje seguro y permite reintentar o navegar a otra dirección

#### Scenario: Navegador a ancho completo
- **WHEN** el usuario expande el panel hasta el máximo
- **THEN** el navegador ocupa el área del chat y puede reducirse de nuevo sin perder la página o conversación
