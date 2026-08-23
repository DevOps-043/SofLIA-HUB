## ADDED Requirements

### Requirement: API con alcance de workspace

Project Hub SHALL exponer `/api/v1` con respuestas `{ data, meta?, error? }`, `correlation_id`, validación de entrada y autorización por workspace y proyecto.

#### Scenario: Miembro lista proyectos de su workspace

- **WHEN** un miembro activo presenta un access token válido y el workspace correcto
- **THEN** recibe únicamente proyectos visibles dentro de ese workspace

#### Scenario: Usuario intenta cruzar organizaciones

- **WHEN** un usuario autenticado solicita un proyecto de otro workspace
- **THEN** la API responde `403` sin revelar datos del proyecto

### Requirement: Intercambio federado

Project Hub SHALL validar un JWT real de SOFIA antes de sincronizar identidad y emitir sus propios access y refresh tokens.

#### Scenario: Token SOFIA inválido

- **WHEN** el token no puede verificarse con SOFIA
- **THEN** no se crea sesión ni usuario y se responde `401`

### Requirement: Escrituras idempotentes

Las mutaciones de importación SHALL aceptar `Idempotency-Key` y devolver la misma respuesta para repeticiones equivalentes.

#### Scenario: Reintento concurrente de una reunión

- **WHEN** dos solicitudes aprobadas usan la misma clave, actor y workspace
- **THEN** existe una sola evidencia y cada tarea se crea o vincula una sola vez

### Requirement: Aprobación humana

SofLIA-HUB SHALL mostrar proyecto y acciones propuestas y no modificará IRIS antes de aprobación explícita.

#### Scenario: Usuario cancela la revisión

- **WHEN** el usuario descarta la propuesta
- **THEN** no se crea proyecto, evidencia ni tarea en Project Hub

### Requirement: Evidencia de navegador segura

SofLIA-HUB SHALL guardar solo URL saneada, título, resumen, texto DOM acotado, fecha y SHA-256 de pestañas seleccionadas.

#### Scenario: Pestaña usa esquema prohibido

- **WHEN** una pestaña usa `file:`, `data:`, `javascript:` o un esquema interno
- **THEN** se excluye de la colección y se informa el motivo sin enviar su contenido

### Requirement: Acceso a archivos privados

Project Hub SHALL mantener archivos en un bucket privado y entregar únicamente URLs firmadas de corta duración.

#### Scenario: Archivo no coincide con su declaración

- **WHEN** la finalización detecta tamaño, MIME o ruta distintos de la intención
- **THEN** la evidencia no se activa y la API responde un error validado

