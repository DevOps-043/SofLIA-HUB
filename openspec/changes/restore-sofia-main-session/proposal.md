## Why

Pulse Hub puede conservar un perfil local de SOFIA cuando ya no existe una sesión Supabase verificable. La interfaz parece autenticada, pero las consultas de organizaciones y el proceso main operan como `anon`; esto produce `42501 permission denied for table users` y hace que WhatsApp descarte mensajes antes de invocar al agente.

## What Changes

- Tratar únicamente una sesión Supabase SOFIA verificable como autenticación restaurada; el snapshot local queda limitado a datos de presentación y nunca vuelve a fabricar una sesión.
- Publicar al proceso main los tokens de acceso y refresco de SOFIA mediante el contrato de ida de `auth:set-state`, sin devolverlos al renderer ni registrarlos.
- Aplicar la sesión al cliente SOFIA de main y custodiar solo el refresh token cifrado con `safeStorage`, con restauración en frío y revocación en logout.
- Restaurar la identidad SOFIA antes de inicializar WhatsApp y los detectores pasivos, y sincronizar el estado observable de main con la identidad restaurada.
- Mantener cerrada la autorización de WhatsApp cuando falta sesión verificable o membresía activa; no se relajan RLS, allowlists ni capacidades.
- Añadir pruebas de contrato, persistencia, arranque, consulta de principal y regresión de la sesión local huérfana.

### No objetivos

- No cambiar las preferencias de privacidad de WhatsApp ni simular confirmaciones de lectura o presencia.
- No agregar políticas RLS, `service_role` ni acceso global a usuarios de otras organizaciones.
- No modificar el modelo de roles, capacidades o listas permitidas del canal.
- No desplegar ni ejecutar migraciones o cambios remotos.

## Capabilities

### New Capabilities

- `sofia-main-session`: sesión verificable de SOFIA compartida de forma segura con main, restaurada antes de los servicios y usada por consultas organizacionales y autorización de canales.

### Modified Capabilities

Ninguna. La capacidad relacionada `main-process-identity` todavía pertenece a un cambio activo y no existe bajo `openspec/specs/`; este cambio define el contrato específico de SOFIA sin alterar specs canónicas archivadas.

## Impact

- Renderer: `src/services/sofia-auth.ts`, `src/contexts/auth/useAuthProviderModel.ts`, `src/services/auth-state.ts`.
- Electron main: `electron/iris/clients.ts`, `electron/auth-state-handlers.ts`, `electron/main/bootstrap.ts` y nuevos módulos de sesión SOFIA.
- IPC: se amplía el payload de `auth:set-state`; `auth:get-state` conserva exactamente la respuesta pública sin credenciales, por lo que no cambia la API de lectura.
- Datos y permisos: no hay cambio de esquema; las consultas existentes pasan a ejecutarse con el JWT del usuario y siguen sujetas a RLS de SOFIA.
- Operación: el usuario con un snapshot huérfano deberá iniciar sesión de nuevo una vez; después el refresh token cifrado permite recuperar el canal tras reiniciar.
- Documentación: manual de agentes runtime, seguridad, contratos IPC y changelog.
