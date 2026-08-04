## ADDED Requirements

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

#### Scenario: Reapertura
- **WHEN** el usuario selecciona una entrada
- **THEN** el navegador navega a su URL HTTP(S) validada

#### Scenario: Borrado explícito
- **WHEN** el usuario confirma borrar historial
- **THEN** el archivo de historial queda vacío sin borrar cookies, credenciales o extensiones

