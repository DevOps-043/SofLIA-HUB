## Context

Ver `proposal.md` — Why para la motivación.

Restricciones que dan forma al enfoque, todas verificadas en código:

- SofLIA Learning implementa su OAuth a mano: intercambia el código en su servidor con el `client_secret` y cierra el flujo emitiendo tokens propios (`RefreshTokenService` + sesión legada) en cookies. Nunca produce una sesión de Supabase Auth.
- El alta por OAuth crea el usuario en `auth.users` **sin contraseña**, por lo que `signInWithPassword` —única vía del Hub hoy, en `src/services/sofia-auth.ts`— falla siempre para esas cuentas.
- Learning y el proyecto que el Hub llama SOFIA son **la misma instancia Supabase**. El `createAdminClient()` de Learning tiene `service_role` sobre ella, así que Learning puede emitir acceso para esa identidad; el Hub no puede ni debe.
- El Hub ya sabe canjear un `hashed_token` por sesión: `src/services/lia-session-exchange.ts` lo hace con `verifyOtp({ type: 'magiclink' })` sobre el cliente anónimo, con su taxonomía de errores y su política de reintento.
- El esquema `soflia://` ya está declarado y registrado (`electron/main/bootstrap.ts`), y `parseAppProtocolCommand` ya enruta dos comandos. En Windows cualquier aplicación puede registrar ese mismo esquema.

## Goals / Non-Goals

**Goals:**

- Entregar al Hub una sesión SOFIA indistinguible de la que produce el inicio por contraseña, para que todo lo que ya existe aguas abajo siga igual.
- Que el resultado del inicio federado sea inservible para cualquiera que no sea la instancia de escritorio que lo pidió.
- Mantener el `service_role` y el `client_secret` confinados en Learning.
- Reusar el patrón de canje ya probado en `federate-sofia-lia-session` en vez de inventar uno nuevo.

**Non-Goals:**

- Habilitar los proveedores nativos de Supabase Auth: este diseño existe precisamente para no crear un segundo SSO en paralelo al de Learning.
- Cambiar el flujo web de Learning, sus cookies o su modelo de sesión propio.
- Modificar `src/lib/supabase-factory.ts`: `verifyOtp` no requiere `flowType: 'pkce'`, ese ajuste solo haría falta si usáramos el OAuth nativo de Supabase.
- Alterar `federated-operational-session`: este cambio se conecta antes y le entrega la sesión SOFIA que ya espera.
- Resolver el inicio por WhatsApp para cuentas sin contraseña.

## Decisions

### Learning emite un `hashed_token` de enlace mágico y el Hub lo canjea

El endpoint de canje de Learning termina en `admin.auth.admin.generateLink({ type: 'magiclink', email })` sobre el proyecto SOFIA y devuelve **solo** `hashed_token`. El Hub lo consume con `verifyOtp({ token_hash, type: 'magiclink' })` y obtiene una sesión Supabase ordinaria; a partir de ahí el perfil, la membresía y `ensureLiaSession` siguen el camino actual sin un solo cambio.

`generateLink` conserva el usuario existente por correo, de modo que el UUID no se mueve y las políticas por fila siguen resolviendo igual.

Alternativas descartadas:

- **Reusar los tokens propios de Learning**: los rechaza `sofia.auth.getUser()` en la Edge Function ya desplegada. Obligaría a reemplazar toda la cadena de confianza existente.
- **Transportar la sesión completa en el deep link**: la URL de retorno no es confidencial y queda en registros del sistema operativo y en el historial del navegador.
- **Un endpoint administrativo que fabrique tokens de sesión directamente**: Supabase no ofrece una vía soportada para ello sin pasar por enlace u OTP.

### La prueba de retorno se liga a la instancia con un desafío PKCE propio

En el escritorio, el esquema propio no es un canal confidencial: otra aplicación local puede registrarlo e interceptar el retorno. Por eso el ticket, por sí solo, no basta para obtener una sesión.

El renderer genera un `code_verifier` aleatorio y envía al iniciar el flujo su `code_challenge` (SHA-256, base64url) junto con un `state` de correlación. Learning guarda el desafío junto al ticket y el canje exige el verificador, que nunca sale del renderer ni se escribe a disco. El ticket viaja por el deep link; el verificador viaja por una conexión HTTPS directa del Hub a Learning. Quien intercepte el primero no tiene el segundo.

La cookie que recuerda la petición entre el arranque y el callback es `httpOnly`, `sameSite=lax` y de vida corta, pero **no va firmada**: firmarla no protegería nada, porque su contenido es un desafío que el propio escritorio eligió. Inyectarla en el navegador de otra persona tampoco sirve, ya que el ticket resultante se entrega al `soflia://` de esa máquina y no a la del atacante.

Esto es lo que RFC 8252 admite para esquemas de uso privado: se aceptan siempre que el flujo use PKCE.

Alternativa descartada: **servidor local en `http://127.0.0.1:<puerto>`**, que RFC 8252 prefiere porque ningún otro proceso puede secuestrar el puerto ya enlazado. Se descarta ahora porque exige levantar un servidor efímero por intento y dispara el diálogo de firewall de Windows en el primer uso, mientras que el esquema ya está registrado y probado. Queda como mejora posterior si aparece evidencia de secuestro.

### El destino del retorno está fijo en el servidor

Learning construye la URL `soflia://auth/callback` en su propio código. **No** acepta un destino enviado por el cliente en ningún parámetro. Es la única defensa efectiva contra convertir el modo escritorio en un redirector abierto que exfiltre tickets hacia un destino atacante.

### El ticket vive en una tabla propia, hasheado y de un solo uso

Tabla nueva en el proyecto SOFIA que guarda el **hash** del ticket —nunca el valor—, el desafío, el usuario, la expiración y la marca de consumo, siguiendo la convención que Learning ya usa para sus tokens de refresco. Con RLS habilitada y **sin políticas**: solo `service_role` la toca, así que la postura por defecto es negar.

El consumo es un `UPDATE ... SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING user_id`. El bloqueo de fila de Postgres hace que dos canjes simultáneos no puedan prosperar ambos, sin necesidad de coordinación adicional.

La ventana de validez es corta —del orden de un minuto— porque el ticket solo tiene que sobrevivir un redirect y una llamada inmediata.

### El canje falla con un código único e indistinguible

Ticket inexistente, expirado, ya consumido o con verificador incorrecto devuelven todos `invalid_ticket`. Distinguirlos permitiría a un atacante con un ticket interceptado averiguar si sigue vivo. Los otros dos códigos son `access_denied` (autenticado pero sin membresía activa) y `exchange_unavailable` (transitorio), la misma taxonomía y la misma política de reintento que ya usa `lia-session-exchange.ts`: no se reintentan 401 ni 403, sí los 5xx y de red.

### La identidad sale del estado de sesión de Learning, nunca del cliente

Al cerrar su callback OAuth, Learning ya conoce al usuario autenticado. El ticket se emite ligado a ese `user_id`. El endpoint de canje resuelve el correo desde la fila del ticket y comprueba `organization_users.status = 'active'` antes de generar nada. Un correo o identificador enviado en el cuerpo de la petición se ignora.

### La sesión web existente de Learning se acepta

Si la persona ya tiene sesión abierta en Learning en su navegador, el modo escritorio la aprovecha y no vuelve a pedir credenciales. Es el mismo dominio de confianza y forzar reautenticación solo añadiría fricción sin cerrar ninguna vía: quien controla ese navegador ya tiene acceso completo al producto web. El ticket resultante sigue ligado a la instancia de escritorio que lo pidió.

### El interruptor vive en el cliente

Una variable de configuración pública habilita o esconde la entrada federada y hace que el Hub ignore un retorno de este flujo. Permite revertir sin publicar versión y sin tocar Learning. No introduce ningún secreto en el cliente: solo la URL base de Learning y el interruptor.

## Risks / Trade-offs

- [Otra aplicación local registra `soflia://` e intercepta el ticket] → El ticket es inútil sin el verificador, que nunca sale del renderer; además es de un solo uso y de vida corta.
- [El modo escritorio se convierte en redirector abierto] → El destino se construye en el servidor de Learning; ningún parámetro del cliente influye en él.
- [El deep link no llega en macOS] → Hoy no existe manejador `open-url`; sin él el flujo falla en silencio en esa plataforma. Se añade en este cambio y se prueba explícitamente.
- [El retorno llega antes de que el renderer esté listo, en arranque en frío] → Se retiene en el estado del proceso principal y se entrega cuando el renderer se suscribe, como ya se hace con los comandos de protocolo existentes.
- [El ticket queda en el historial del navegador o en registros del sistema] → Vida corta, un solo uso e inservible sin el verificador; no se registra en el cliente ni en el servidor.
- [Los dos repositorios se desincronizan y el cliente sale antes que el backend] → Desplegar Learning y aplicar la migración primero, con el interruptor del Hub apagado; encenderlo solo tras verificación cruzada.
- [Acumulación de tickets consumidos o vencidos] → Limpieza periódica; la tabla no participa en ninguna consulta de producto.
- [Se autentica una identidad sin membresía activa] → Se deniega antes de generar acceso y el escritorio no deja sesión abierta, reusando la lógica de denegación existente.
- [Los usuarios solo-SSO siguen sin poder entrar por WhatsApp] → Consecuencia aceptada y documentada; se aborda en un cambio aparte.

## Migration Plan

1. Aplicar en el proyecto SOFIA la migración de la tabla de tickets, dejando su copia registrada en `database/sofia-learning/migrations/`.
2. Desplegar en Learning el modo escritorio y el endpoint de canje. Ningún cliente los usa todavía; el flujo web queda intacto.
3. Verificar contra el despliegue con cuentas controladas: cuenta solo-SSO sin contraseña, cuenta con contraseña, cuenta sin membresía activa, ticket reutilizado, ticket expirado y verificador incorrecto.
4. Publicar el Hub con el interruptor apagado y confirmar que el inicio por contraseña no cambió.
5. Encender el interruptor y observar la distribución de códigos de resultado sin registrar correos ni tokens.

**Rollback**: apagar el interruptor del Hub, lo que devuelve el inicio por contraseña como única vía de forma inmediata y sin publicar versión. El endpoint de Learning puede quedarse desplegado sin efecto; si se decide retirarlo, la tabla se elimina sin migración inversa porque no guarda nada que otro dato referencie. Ningún UUID se mueve, así que no hay estado de usuario que revertir.

## Open Questions

- Los valores definitivos de la ventana de validez del ticket y del límite de intentos por dirección deben confirmarse con la operación de Learning antes del despliegue; no cambian el diseño ni el desglose de tareas.
- La observabilidad productiva debe elegir un contador agregado por código de resultado que no incluya correo, ticket, verificador ni `hashed_token`.
