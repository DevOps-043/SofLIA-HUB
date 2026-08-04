## Why

Pulse Hub autentica al usuario en SOFIA pero intenta abrir las conversaciones reutilizando esa misma contraseña en un segundo proyecto. Cuando la contraseña cambia o las cuentas divergen, el inicio principal funciona y el chat queda bloqueado con mensajes técnicos; la autenticación secundaria debe derivarse automáticamente de la identidad principal.

## What Changes

- SOFIA se convierte en la única autenticación visible para los usuarios del Hub.
- Un backend confiable valida la sesión SOFIA y emite una prueba de acceso de un solo uso para la cuenta operativa del mismo correo.
- El cliente deja de enviar la contraseña SOFIA a Lia y elimina el alta/inicio/reparación mediante contraseña secundaria.
- La restauración y el reintento de conversaciones se vuelven automáticos e idempotentes.
- Los estados degradados usan lenguaje simple, sin nombres internos ni instrucciones de credenciales.
- Se documentan el despliegue, secretos, seguridad, reversión y evidencia necesaria antes de habilitar el intercambio en producción.

## Capabilities

### New Capabilities

- `federated-operational-session`: intercambio seguro y automático de una sesión SOFIA válida por una sesión operativa de conversaciones para la misma identidad.

### Modified Capabilities

Ninguna. No existen especificaciones canónicas previas bajo `openspec/specs/`; el cambio activo de endurecimiento conserva su alcance histórico y este contrato estructural se define aparte.

## Impact

- Renderer: `src/contexts/auth/`, servicio de intercambio y estados de chat.
- Backend Lia: nueva Edge Function y configuración con validación explícita del token SOFIA.
- Autenticación/datos: se conserva el usuario y UUID existente de Lia; el alta faltante se realiza idempotentemente sin contraseña compartida.
- Seguridad: se introduce un puente entre proyectos; la clave administrativa permanece exclusivamente en backend y los tokens no se persisten ni registran.
- Operación: requiere configurar secretos y desplegar la función antes de publicar el cliente; no agrega canales IPC ni cambia esquemas SQL.
