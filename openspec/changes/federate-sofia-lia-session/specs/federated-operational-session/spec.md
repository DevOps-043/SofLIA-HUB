## ADDED Requirements

### Requirement: SOFIA es la única autenticación visible
El sistema SHALL autenticar al usuario visible únicamente contra SOFIA y MUST NOT enviar, reutilizar, persistir ni solicitar esa contraseña para abrir la sesión operativa de conversaciones.

#### Scenario: Inicio tras un cambio de contraseña
- **WHEN** un usuario con membresía activa inicia sesión con su contraseña SOFIA vigente aunque la cuenta operativa conserve otra contraseña
- **THEN** el sistema abre automáticamente sus conversaciones sin pedir otra credencial ni mostrar una reparación técnica

#### Scenario: Intentos fallidos antes del inicio correcto
- **WHEN** el usuario falla uno o más intentos SOFIA y después autentica correctamente
- **THEN** los intentos fallidos no crean ni modifican una sesión operativa y el intento correcto inicia el intercambio automático

### Requirement: El backend valida la identidad federada
El backend SHALL aceptar únicamente un JWT SOFIA verificable con correo confirmado, MUST obtener el correo del usuario verificado y MUST comprobar una membresía activa del mismo sujeto antes de emitir acceso operativo.

#### Scenario: Token válido y membresía activa
- **WHEN** la función recibe un JWT SOFIA válido cuyo sujeto tiene al menos una membresía activa
- **THEN** genera un token de un solo uso para el correo verificado de ese sujeto

#### Scenario: Token ausente o inválido
- **WHEN** la función no recibe un bearer token válido para SOFIA
- **THEN** responde sin generar enlace, usuario ni sesión operativa

#### Scenario: Correo no confirmado
- **WHEN** el JWT pertenece a un usuario cuyo correo no está confirmado
- **THEN** la función deniega el intercambio antes de consultar membresía o generar acceso operativo

#### Scenario: Usuario sin membresía activa
- **WHEN** el JWT es válido pero el sujeto no tiene membresía activa
- **THEN** la función deniega el intercambio antes de ejecutar una operación administrativa en Lia

### Requirement: La sesión operativa conserva identidad y RLS
El sistema SHALL canjear el token de un solo uso por una sesión Lia ordinaria y SHALL conservar el UUID Lia existente para cuentas registradas con el mismo correo.

#### Scenario: Usuario Lia existente
- **WHEN** el correo SOFIA verificado ya corresponde a un usuario Lia
- **THEN** la sesión resultante usa el mismo UUID Lia y mantiene acceso a sus conversaciones existentes bajo RLS

#### Scenario: Usuario Lia faltante
- **WHEN** el correo autorizado todavía no existe en Lia
- **THEN** el backend lo crea de forma idempotente sin una contraseña compartida y emite la sesión correspondiente

#### Scenario: Sesión persistida de otra identidad
- **WHEN** el dispositivo conserva una sesión Lia cuyo correo no coincide con la identidad SOFIA actual
- **THEN** el cliente cierra esa sesión localmente antes de intercambiar la identidad actual

### Requirement: Los secretos y pruebas de acceso permanecen confinados
El sistema MUST mantener toda clave administrativa en backend y MUST NOT registrar ni persistir JWT SOFIA, enlaces mágicos, hashes de token o contraseñas.

#### Scenario: Respuesta exitosa del intercambio
- **WHEN** el backend emite la prueba de acceso
- **THEN** devuelve únicamente el hash necesario con cabeceras que impiden caché y el cliente lo canjea inmediatamente

#### Scenario: Ejecución del cliente
- **WHEN** Electron solicita una sesión operativa
- **THEN** no contiene ni recibe una clave `service_role` y todas las consultas posteriores siguen usando la sesión Lia limitada por RLS

### Requirement: La indisponibilidad no expone detalles técnicos
El sistema SHALL mantener activa la sesión SOFIA si falla el intercambio por una causa transitoria, SHALL bloquear solo las funciones que requieren conversaciones y SHALL ofrecer un reintento con lenguaje no técnico.

#### Scenario: Falla transitoria
- **WHEN** SOFIA, la Edge Function o Lia no responden temporalmente
- **THEN** la interfaz muestra “No pudimos cargar tus conversaciones”, no menciona servicios internos o credenciales y permite reintentar

#### Scenario: Reintento exitoso
- **WHEN** el usuario reintenta después de recuperarse el servicio
- **THEN** el sistema abre la sesión operativa, oculta el estado degradado y habilita las conversaciones sin volver a pedir la contraseña
