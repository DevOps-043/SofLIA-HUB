## Purpose

Proteger las credenciales de Workspace en el escritorio y mantenerlas asociadas a la identidad autenticada durante todo su ciclo de vida.

## ADDED Requirements

### Requirement: Custodia cifrada por propietario
Las credenciales SHALL persistirse cifradas por el SO y vinculadas a un propietario exacto, sin fallback a texto plano.

#### Scenario: Cifrado no disponible
- **WHEN** no hay custodia segura o el archivo es inválido/de otro propietario
- **THEN** no se restaura ni se escribe una conexión insegura y se devuelve un error seguro

#### Scenario: Interrupción o escrituras concurrentes
- **WHEN** falla una escritura o coinciden actualizaciones
- **THEN** se conserva una versión completa y no se publican estados exitosos parciales

### Requirement: Transición heredada sin apropiación
El sistema SHALL conservar de forma cifrada el contenido heredado y restaurar únicamente las conexiones con propietario coincidente, sin reimportar conexiones desconectadas.

#### Scenario: Conexión sin dueño o de otro actor
- **WHEN** el legado contiene conexiones sin propietario o de otro usuario
- **THEN** se conservan cifradas y no se activan para el usuario actual

#### Scenario: Desconexión seguida de reinicio
- **WHEN** el usuario desconecta una cuenta ya importada
- **THEN** un reinicio no la vuelve a importar desde el archivo heredado

### Requirement: Sesión vigente durante operaciones
La restauración, autorización, renovación, consultas y polling SHALL invalidarse al cambiar o cerrar sesión, incluso si la misma identidad vuelve después.

#### Scenario: Respuesta tardía A/B/A
- **WHEN** una respuesta iniciada por A llega tras cambiar a B y volver a A
- **THEN** no modifica credenciales ni publica eventos del contexto anterior

#### Scenario: Consumidores Workspace
- **WHEN** Gmail, Drive o Chat solicitan autenticación después de cerrar sesión
- **THEN** no reciben la credencial anterior y conservan su manejo de no conectado
