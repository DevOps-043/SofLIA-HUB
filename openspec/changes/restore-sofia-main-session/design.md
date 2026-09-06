## Context

Ver `proposal.md` — Why. Existen dos clientes distintos en el renderer: SOFIA es la identidad principal y Lia mantiene conversaciones. `useAuthProviderModel` publica los tokens Lia a `main/hub-session`, pero del lado SOFIA solo envía un access token para el canje de Project Hub. El cliente SOFIA memoizado de main se crea con la clave anónima, no recibe sesión y ejecuta así las consultas de `CommunicationHubService` y `getSofiaUserByEmail`.

Además, `SofiaAuthService.getSession()` fabrica un objeto con forma de `Session` desde `localStorage` cuando Supabase no restaura credenciales. Ese objeto contiene usuario pero no JWT; `useAuthLifecycle` lo acepta y deja una sesión visual huérfana que solo puede producir consultas anónimas.

El contrato ya permite tokens de ida por `auth:set-state`, `safeStorage` ya custodia el refresh token de Lia y `restoreHubSession()` ya se ejecuta antes de los servicios. El cambio debe extender esos patrones sin introducir una clave administrativa ni relajar RLS.

## Goals / Non-Goals

**Goals:**

- Mantener una sola identidad visible, SOFIA, y exigir que sea verificable.
- Dar al cliente SOFIA de main una sesión renovable y recuperable en frío.
- Sincronizar el gate de main con el usuario que SOFIA autenticó, no solo con datos declarados por el renderer.
- Permitir que WhatsApp resuelva usuario y membresía antes de descartar un mensaje autorizado.

**Non-Goals:**

- Consultar SOFIA con `service_role` o ampliar políticas de lectura.
- Autorizar números sin membresía activa como sustituto permanente de SOFIA.
- Cambiar el protocolo de WhatsApp, sus preferencias de privacidad o Baileys.
- Mantener sesiones de varios usuarios simultáneos en un mismo proceso main.

## Decisions

### D1. El snapshot local deja de ser una sesión

`SofiaAuthService.getSession()` devolverá únicamente el resultado real de `sofiaSupa.auth.getSession()`. Si no existe, devuelve `null`; `useAuthLifecycle` ya sabe limpiar el estado. `sofia-session` se conserva temporalmente como caché de presentación escrita durante login, pero nunca se convierte mediante cast en credencial.

Alternativa descartada: conservar el pseudo-objeto y etiquetarlo como degradado. No permite distinguir una caída de red con JWT válido de una credencial inexistente y perpetúa consultas anónimas que nunca se recuperarán.

### D2. El contrato IPC publica el par completo de SOFIA

El payload añade `sofiaRefreshToken` junto a `sofiaAccessToken`. Ambos son opcionales para compatibilidad con renderers anteriores, pero `main` solo aplica la sesión cuando recibe el par completo. `auth:get-state` mantiene `{ authenticated, userId }` y ninguna respuesta incluye credenciales.

Antes de habilitar el gate, main compara el `user.id` devuelto por `setSession` con `userId`. Una discrepancia revoca la sesión recién aplicada y mantiene el acceso negado.

Alternativa descartada: aceptar solo el access token. Caduca en minutos, no permite restauración en frío y dejaría WhatsApp roto tras cerrar la ventana.

### D3. Sesión SOFIA separada de la sesión Lia

Se crea un coordinador `main/sofia-session.ts` que aplica, restaura, renueva y revoca la sesión del cliente SOFIA. Aunque su ciclo se parece al de `hub-session`, los tokens pertenecen a proyectos distintos y nunca deben intercambiarse. La custodia compartirá un helper parametrizado de archivo cifrado para evitar duplicar lógica, conservando fachadas con nombres específicos y archivos separados (`hub-session.enc`, `sofia-session.enc`).

Alternativa descartada: reutilizar `hub-session.enc` o un único objeto con ambos tokens. Una escritura parcial podría sustituir una credencial por otra y el rollback sería menos claro.

### D4. SOFIA determina el estado protegido en el arranque y en IPC

En arranque se restaura primero SOFIA. Solo un resultado aplicado ejecuta `setAuthState({ authenticated: true, userId })`; después se restaura Lia y se inicializan servicios. Así `WhatsAppService.connect()` supera su gate durante la autoconexión y las consultas de principal ya llevan JWT.

En `auth:set-state`, la aplicación de SOFIA ocurre antes de fijar un estado autenticado. Un payload sin tokens puede actualizar servicios secundarios para compatibilidad, pero no habilita el gate si no existe ya una sesión SOFIA coincidente. Logout revoca SOFIA, Lia y Project Hub.

Alternativa descartada: confiar en `authenticated` y `userId` antes de verificar tokens, que es el defecto actual del snapshot huérfano.

### D5. No se añade migración RLS

El error `42501` se produce porque main consulta como `anon`; el renderer válido ya depende de las políticas existentes. La corrección cambia el rol efectivo a `authenticated` con el JWT del usuario. Si una prueba real posterior demuestra que la política autenticada no permite la consulta requerida dentro de la organización, se abrirá un cambio de datos separado con aislamiento explícito; este cambio no ampliará permisos por hipótesis.

### D6. La resolución de WhatsApp conserva deny-by-default

No se elimina `CommunicationHubService` ni el requisito `personal_agent`. La prueba de regresión representará un cliente autenticado y verificará que un número permitido con membresía activa llega al evento del agente; sesión ausente, miembro inactivo y número fuera de allowlist siguen descartándose.

## Risks / Trade-offs

- [El refresh token SOFIA es una credencial de larga vida] → Guardar solo ese token, cifrado por `safeStorage`, sin fallback en texto plano, sin logs y borrándolo en logout o rechazo.
- [Dos restauraciones remotas pueden aumentar el arranque] → Ejecutarlas antes de servicios pero con degradación controlada; un fallo no bloquea la ventana y deja el gate cerrado.
- [Renderer anterior no publica `sofiaRefreshToken`] → El payload sigue válido, pero no crea una identidad nueva; el usuario deberá actualizar/iniciar sesión con la versión corregida.
- [Sesiones Lia y SOFIA pueden pertenecer a usuarios diferentes] → SOFIA gobierna el gate; Lia conserva su validación propia y no autoriza consultas SOFIA.
- [La sesión SOFIA autenticada puede seguir sin política para leer otros usuarios] → No ampliar RLS preventivamente; verificar el caso del usuario propio y registrar como riesgo cualquier necesidad organizacional adicional.

## Migration Plan

1. Publicar el cliente que envía ambos tokens SOFIA y el main que sabe aplicarlos.
2. En el primer arranque, un snapshot huérfano se invalida y el usuario vuelve a iniciar sesión; el login guarda inmediatamente el token cifrado de main.
3. En reinicios posteriores, restaurar SOFIA antes de los servicios y comprobar en logs seguros el resultado `aplicada/sin-sesion/rechazada`.
4. Verificar con una cuenta controlada la carga de organización y un mensaje WhatsApp desde el número permitido.

Rollback: revertir el código y eliminar únicamente `sofia-session.enc` del perfil local si fuera necesario. `hub-session.enc`, datos de WhatsApp y bases remotas no se modifican. El rollback recupera el defecto de sesión huérfana y no debe mantenerse como solución.
