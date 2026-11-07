## Purpose

Conservar credenciales Project Hub del propietario autenticado y evitar que trabajo asíncrono obsoleto restaure o use una sesión distinta.

## ADDED Requirements

### Requirement: Custodia por propietario
El cliente MUST persistir sólo refresh token/workspaces cifrados mediante backend seguro del SO, ligados al dueño y con cuotas/formato validado. MUST rechazar traslado de archivo entre dueños y MUST NOT adjudicar legado sin dueño ni persistir acceso plano.

#### Scenario: Otro usuario inicia sesión
- **WHEN** cambia el usuario main y se intenta restaurar Project Hub
- **THEN** sólo consulta el archivo del nuevo propietario; no devuelve credenciales/workspaces del anterior

### Requirement: Autenticación invalidable
El cliente MUST invalidar canje, restore, refresh y solicitudes al cambiar identidad o cerrar sesión, incluso A/B/A. MUST descartar respuestas/cambios de disco obsoletos, conservar single-flight vigente y cerrar estado local antes de esperar logout remoto.

#### Scenario: Sesión SOFIA cambia antes de publicar estado main
- **WHEN** cambia la identidad SOFIA verificada y main todavía conserva el identificador anterior
- **THEN** la revalidación rechaza el resultado pendiente sin publicar datos ni credenciales

#### Scenario: Renovación falla con acceso vencido
- **WHEN** vence el acceso y no se puede renovar
- **THEN** no se envía al recurso de negocio ni se informa autenticación vigente

#### Scenario: Refresh responde después de logout
- **WHEN** una renovación pendiente termina tras cerrar sesión
- **THEN** no repone memoria ni custodia y no vuelve a autenticar al usuario

#### Scenario: Canjes terminan fuera de orden
- **WHEN** un canje anterior termina después de uno nuevo válido
- **THEN** no sustituye ni elimina la sesión nueva

### Requirement: Transporte de credenciales acotado
HTTP MUST usar contexto y token capturados, impedir redirección y acotar tiempo/bytes. MUST validar envelope/auth y devolver errores seguros. GET puede reintentarse de forma acotada; una mutación MUST NOT repetirse automáticamente al renovar.

#### Scenario: Mutación recibe 401
- **WHEN** el servidor rechaza una escritura por autenticación
- **THEN** no se reenvía por refresh; la recuperación no duplica el efecto

#### Scenario: Redirección o respuesta inválida
- **WHEN** aparece redirección, respuesta excesiva, credenciales malformadas o mensaje remoto sensible
- **THEN** se rechaza sin seguir el destino ni publicar/persistir credenciales o texto remoto crudo

### Requirement: Integración conservada
La fachada MUST conservar consumidores/contratos. Sin identidad, status MUST ser vacío y no restaurar/red. La verificación MUST incluir disco/cifrado, concurrencia y HTTP reales locales, distinguiéndolos de despliegue y cuentas reales.

#### Scenario: Arranque antes de identidad SOFIA
- **WHEN** se consulta status sin usuario main autenticado
- **THEN** informa configuración y authenticated=false sin abrir el archivo global heredado ni contactar al servidor
