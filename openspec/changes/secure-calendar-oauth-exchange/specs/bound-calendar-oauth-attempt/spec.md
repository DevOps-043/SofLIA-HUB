## Purpose

Vincular la conexión OAuth de calendario al intento autorizado y a la sesión vigente, con prueba criptográfica, límites de recepción y cierre verificable de recursos.

## ADDED Requirements

### Requirement: Autorización por intento y cliente nativo
Google y Microsoft MUST vincular la autorización y canje con state y PKCE S256 únicos por intento. Microsoft MUST usar un cliente público y validar nonce OIDC con SDK parcheado, sin exigir un secreto confidencial ni ampliar scopes.

#### Scenario: Éxito legítimo
- **WHEN** llega un código con state del intento vigente
- **THEN** se canjea sólo el código con su verifier y se persiste bajo el actor original después de revalidarlo

#### Scenario: State ajeno o código ambiguo
- **WHEN** el callback presenta state incorrecto/duplicado o código vacío/URL/duplicado
- **THEN** se rechaza sin consumir ni canjear el intento legítimo

### Requirement: Frontera de callback loopback
El receptor MUST escuchar sólo loopback antes de abrir autorización y aceptar únicamente método, ruta, Host y límites del contrato. MUST NOT reflejar código, token o errores del proveedor en UI/logs.

#### Scenario: Puerto ocupado
- **WHEN** no se puede abrir el listener registrado
- **THEN** falla de forma controlada sin abrir navegador ni dejar ventana o temporizador pendiente

#### Scenario: Petición ajena
- **WHEN** llega una petición a otra ruta/Host, método no permitido o fuera de cuota
- **THEN** devuelve un rechazo y no se confirma ninguna conexión

### Requirement: Navegador externo y cancelación
La autorización MUST abrirse sólo en un navegador externo y destino permitido. La ventana local MUST contener únicamente estado/cancelación y negar navegación/popups, sin cargar el proveedor.

#### Scenario: Destino no permitido
- **WHEN** la URL de autorización no corresponde al proveedor/prueba/redirect del intento
- **THEN** no se abre el navegador ni se intercambia código

### Requirement: Cierre y contexto vigente
Cancelación, timeout, error o revocación de contexto MUST retirar ventana, listener, conexiones y timers propios de forma idempotente. MUST NOT publicarse una conexión por respuestas tardías o A/B/A. La finalización MUST esperar cierre físico del listener.

#### Scenario: Revocación durante autorización o canje
- **WHEN** cambia la sesión mientras existe un intento o respuesta pendiente
- **THEN** se cancela la recepción y ningún resultado obsoleto se persiste o emite como conectado

#### Scenario: Cancelación antes de escuchar
- **WHEN** el intento se cancela mientras se abre el listener
- **THEN** al terminar el bind se retira antes de completar el resultado y no queda puerto ocupado
