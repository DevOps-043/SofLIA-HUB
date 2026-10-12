## ADDED Requirements

### Requirement: Portada minimalista
El inicio MUST mostrar el logo sin anillos, sin cabecera SofLIA ni la frase
«Tu espacio para explorar», y sin el pie «Conecta tus ideas». Su buscador MUST
tener contorno ovalado y botón circular con icono de búsqueda.

#### Scenario: Temas y tamaños
- **WHEN** se abre el inicio en claro u oscuro, en una ventana normal o estrecha
- **THEN** el buscador es legible y no hay desbordamiento horizontal

### Requirement: Navegación explícita desde la barra
El hover MUST NOT seleccionar el destino que Enter ejecutará. El campo vacío
MUST NOT abrir Google ni enviar una navegación inválida. Las flechas MUST
permitir elegir el primer o último resultado desde la selección vacía.

#### Scenario: Cursor sobre una sugerencia
- **WHEN** se escribe texto, se pasa el cursor por una sugerencia y se envía
- **THEN** se busca el texto; sólo clic o selección por flechas abre el resultado

#### Scenario: Inicio vacío
- **WHEN** se enfoca y envía la barra vacía del inicio
- **THEN** el inicio permanece visible y no se consulta historial automáticamente

### Requirement: Continuidad de la página
Mostrar sugerencias en la portada MUST NOT cambiar sus dimensiones ni
capturarla. La portada MUST conservar su destino local sin fallback
automático a Google. La mejora de carga MUST tener evidencia nativa verificable.

#### Scenario: Abrir y cerrar sugerencias
- **WHEN** aparecen resultados y se cierran con Escape
- **THEN** la portada conserva posición y dimensiones sin esperar un proceso nuevo
