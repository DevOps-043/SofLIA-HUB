## Why

SofLIA Learning implementa su SSO de Google y Microsoft por su cuenta: intercambia el código en su propio servidor y emite tokens propios en cookies, sin producir una sesión de Supabase Auth. El Hub, en cambio, solo sabe autenticar con `signInWithPassword` contra ese mismo proyecto. Como el alta por SSO crea el usuario en `auth.users` **sin contraseña**, quien entró alguna vez con Google o Microsoft y nunca definió una no puede iniciar sesión en el escritorio por ninguna vía: no es una carencia de comodidad, es una exclusión total del producto.

## What Changes

- El Hub gana un segundo camino de inicio, "Continuar con SofLIA Learning", que delega la autenticación en Learning y recibe de vuelta una sesión SOFIA legítima.
- Learning expone un endpoint de canje que valida un ticket de un solo uso y devuelve únicamente el `hashed_token` de un enlace mágico; el Hub lo canjea con `verifyOtp` y obtiene una sesión Supabase ordinaria.
- El ticket viaja por el deep link `soflia://auth/callback` y queda ligado criptográficamente a la instancia del Hub que inició el flujo mediante un desafío PKCE, porque en el escritorio el esquema propio no es un canal confidencial: cualquier aplicación local puede registrarlo.
- El navegador del sistema, no el navegador integrado, ejecuta el paso de identidad; el Hub nunca ve las credenciales ni el `client_secret` del proveedor.
- Una vez obtenida la sesión SOFIA, el perfil, la membresía activa y la federación a Lia siguen exactamente el camino actual, sin cambios.
- El inicio con usuario y contraseña se conserva sin modificaciones y ambos caminos conviven.
- La entrada SSO queda detrás de un interruptor de configuración para poder apagarla sin publicar una versión nueva.
- Se documentan la lista de redirecciones permitidas, los secretos, la evidencia de prueba y el plan de reversión.

No hay cambios que rompan el comportamiento existente: ninguna ruta actual de inicio se elimina ni cambia de contrato.

## Capabilities

### New Capabilities

- `learning-sso-desktop-session`: delegación del inicio de sesión del escritorio en el SSO propio de SofLIA Learning y canje seguro del resultado por una sesión SOFIA de la misma identidad.

### Modified Capabilities

Ninguna. No existen especificaciones canónicas bajo `openspec/specs/`, y `federated-operational-session` conserva su contrato intacto: este cambio se conecta antes de esa federación y le entrega una sesión SOFIA con las mismas propiedades que hoy produce el inicio por contraseña.

## Impact

**Alcance en dos repositorios.** Este cambio cruza el Hub y `SofLIA-Learning`. El presente directorio de OpenSpec solo puede editar el Hub, así que las tareas del lado de Learning se especifican aquí pero se implementan en ese repositorio y se verifican de forma cruzada antes de habilitar la entrada en el cliente.

- Hub — protocolo y proceso principal: `electron/app-protocol.ts` (nuevo comando de callback), `electron/main/app-lifecycle.ts` y `electron/main/bootstrap.ts` (enrutado en caliente y en arranque en frío), más el manejador `open-url` que hoy falta y sin el cual el deep link no llega en macOS.
- Hub — IPC: un canal nuevo para iniciar el flujo en el navegador del sistema y otro para entregar el callback al renderer, ambos con servicio, handler, allowlist de preload y wrapper tipado.
- Hub — renderer: `src/services/sofia-auth.ts` y `src/lib/supabase-factory.ts` para el canje, `src/contexts/auth/` para el estado, y `src/components/Auth.tsx` para la entrada visible.
- Learning: endpoint de inicio en modo escritorio, endpoint de canje y emisión del ticket al cerrar su callback OAuth existente, sin alterar su flujo web actual.
- Datos: una tabla nueva de tickets de un solo uso en el proyecto SOFIA, con su migración registrada en `database/sofia-learning/migrations/`.
- Seguridad: se introduce un puente entre el navegador y el escritorio. La clave `service_role` permanece únicamente en Learning, el ticket es de un solo uso y de vida corta, y ni el ticket ni el `hashed_token` se registran ni se persisten en el cliente.
- Operación: exige desplegar Learning y aplicar la migración antes de publicar el cliente; la reversión es apagar el interruptor de la entrada SSO.
- Sin efecto en empaquetado: el esquema `soflia://` ya está declarado y registrado.

**Fuera de alcance.** El inicio de sesión por WhatsApp (`electron/iris/auth/`) sigue exigiendo contraseña, por lo que los usuarios solo-SSO continuarán sin poder autenticarse por ese canal. Es una consecuencia conocida de este cambio y se aborda por separado.
