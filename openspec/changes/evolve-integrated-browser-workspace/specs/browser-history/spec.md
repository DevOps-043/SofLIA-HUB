## ADDED Requirements

### Requirement: Geometría estable de predicciones
La interfaz SHALL componer las predicciones por encima de overlays del workspace y MUST preservar la geometría exacta de la vista nativa durante su sustitución temporal.

#### Scenario: Chat flotante visible
- **WHEN** las predicciones se abren mientras el chat de SofLIA reserva un inset izquierdo o derecho
- **THEN** el menú se compone por encima del chat y la captura temporal conserva ese mismo inset, ancho y alto sin estirar, ampliar ni desplazar la página

### Requirement: Historial local saneado
El sistema SHALL registrar navegaciones principales HTTP(S) completadas con URL saneada, título y fecha, y MUST limitar la retención a 2.000 entradas.

#### Scenario: Navegación completada
- **WHEN** una página principal HTTP(S) termina de navegar
- **THEN** el sistema agrega una entrada sin username/password de URL y sin contenido de página

#### Scenario: Navegación excluida
- **WHEN** la navegación es `about:blank`, protocolo bloqueado, subframe o carga fallida
- **THEN** el sistema no la incorpora al historial

#### Scenario: Archivo parcial
- **WHEN** el archivo contiene líneas corruptas o queda ausente
- **THEN** el sistema devuelve las entradas válidas o una lista vacía sin impedir navegar

### Requirement: Consulta y control del historial
El usuario SHALL poder buscar, reabrir y borrar explícitamente el historial mediante IPC paginado y validado.

#### Scenario: Búsqueda acotada
- **WHEN** el usuario filtra por texto con un límite permitido
- **THEN** el sistema devuelve coincidencias recientes de título o URL sin exceder el límite

#### Scenario: Predicciones en la barra de dirección
- **WHEN** el usuario enfoca o escribe en la barra de dirección
- **THEN** la interfaz consulta un conjunto acotado del historial, deduplica URLs y permite navegar por las sugerencias con teclado o puntero

#### Scenario: Coincidencia útil y contenida
- **WHEN** el usuario escribe texto corto que también aparece en `http://` o `https://`
- **THEN** la búsqueda compara título, dominio, ruta y consulta sin usar el protocolo como coincidencia, y el listado se superpone bajo la barra de dirección sin desplazar pestañas, favoritos ni página

#### Scenario: Superposición sobre la página nativa
- **WHEN** existen predicciones visibles mientras el `WebContentsView` está activo
- **THEN** la interfaz toma una única captura puntual, oculta temporalmente la capa nativa y muestra el menú flotante sobre esa captura; al seleccionar, pulsar Escape, perder foco o quedar sin resultados restaura la misma vista y sesión sin recargar

#### Scenario: Reapertura
- **WHEN** el usuario selecciona una entrada
- **THEN** el navegador navega a su URL HTTP(S) validada

#### Scenario: Borrado explícito
- **WHEN** el usuario confirma borrar historial
- **THEN** el archivo de historial queda vacío sin borrar cookies, credenciales o extensiones

#### Scenario: Confirmación visual propia
- **WHEN** el usuario pulsa Borrar historial
- **THEN** el sistema muestra un diálogo renderer redondeado que identifica el alcance y solo invoca el borrado después de confirmar

