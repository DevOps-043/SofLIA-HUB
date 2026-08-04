## ADDED Requirements

### Requirement: Credenciales cifradas por origen
El sistema SHALL guardar credenciales únicamente con cifrado seguro del sistema operativo y MUST asociarlas a un origen HTTPS exacto o localhost explícito.

#### Scenario: Guardado válido
- **WHEN** el usuario introduce username y password, confirma guardar y el cifrado seguro está disponible
- **THEN** main cifra el secreto, persiste metadata por origen y devuelve solo metadata sin password

#### Scenario: Cifrado no disponible
- **WHEN** `safeStorage` no ofrece un backend seguro
- **THEN** el sistema rechaza guardar o descifrar y muestra un error controlado sin fallback en claro

#### Scenario: Origen inseguro
- **WHEN** el sitio actual usa HTTP fuera de localhost o un protocolo distinto
- **THEN** el sistema rechaza guardar y rellenar credenciales

### Requirement: Autofill explícito sin exposición del secreto
El sistema MUST rellenar una credencial solo tras gesto explícito, origen coincidente y validación de campos, sin devolver el password al renderer, logs o agente.

#### Scenario: Rellenado autorizado
- **WHEN** el usuario elige una credencial del origen actual y pulsa Rellenar
- **THEN** main descifra y escribe username/password directamente en campos visibles del `WebContentsView`

#### Scenario: Origen distinto
- **WHEN** la credencial no pertenece al origen actual
- **THEN** el sistema deniega el llenado sin descifrar ni revelar el password

#### Scenario: Campos no disponibles
- **WHEN** la página no contiene campos visibles compatibles
- **THEN** el sistema devuelve un error seguro y conserva la credencial

### Requirement: Administración segura de metadata
El usuario SHALL poder listar y eliminar credenciales sin que ninguna respuesta IPC contenga passwords cifrados o descifrados.

#### Scenario: Listado
- **WHEN** el usuario abre Contraseñas
- **THEN** ve origen, username y fechas, pero nunca el secreto o blob cifrado

#### Scenario: Eliminación explícita
- **WHEN** el usuario confirma eliminar una credencial
- **THEN** main borra únicamente el registro indicado y devuelve metadata actualizada

