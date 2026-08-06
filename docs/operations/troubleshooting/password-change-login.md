# Conversaciones no disponibles después del login

Estado: implementación local; despliegue pendiente. Actualizado: 2026-08-05.

<!-- evidence: src/services/lia-session-exchange.ts -->
<!-- evidence: src/contexts/auth/useLiaSession.ts -->
<!-- evidence: database/lia/supabase/functions/sofia-session-exchange/index.ts -->
<!-- evidence: database/lia/audits/federated-chat-account-diagnostic.sql -->
<!-- evidence: openspec/changes/federate-sofia-lia-session -->

## Causa corregida

El diseño anterior autenticaba SOFIA y después reutilizaba la contraseña escrita para abrir una cuenta Auth separada en Lia. Cambiar la contraseña en SofLIA Learning modificaba solo SOFIA; la cuenta operativa podía conservar otro valor y bloquear las conversaciones aunque el login principal fuera correcto.

Los intentos SOFIA incorrectos no llegaban a Lia porque el flujo se detenía antes. El fallo aparecía al tercer intento correcto por la divergencia previa entre dos autoridades de contraseña, no porque esos dos intentos hubieran bloqueado el chat.

## Solución estructural

SOFIA es la única autenticación visible. Después de validar el login y la membresía, el cliente envía el JWT SOFIA vigente a `sofia-session-exchange`. La función:

1. verifica el bearer token y el correo confirmado directamente contra SOFIA;
   para cuentas migradas sin `email_confirmed_at`, admite únicamente la evidencia
   legada completa del mismo UUID y correo (`email_verified = true` y
   `email_verified_at` presente);
2. comprueba una membresía activa del mismo sujeto;
3. obtiene el correo únicamente de la identidad verificada;
4. genera en Lia un token de un solo uso para ese correo;
5. devuelve solo `tokenHash` y evita caché.

El cliente canjea el hash inmediatamente y recibe una sesión Lia ordinaria. Una cuenta Lia existente conserva su UUID y, por tanto, la propiedad/RLS de sus conversaciones. Si falta, `generateLink` crea el usuario de forma idempotente sin compartir una contraseña.

La aplicación ya no llama `signInWithPassword`, `signUp` ni `updateUser` de Lia durante el login SOFIA, no solicita una contraseña anterior y no expone nombres internos en la UI.

## Estado visible

Ante una indisponibilidad, SOFIA permanece activa y solo se bloquean las funciones que necesitan conversaciones. La UI muestra:

> No pudimos cargar tus conversaciones. Tu sesión sigue activa. Comprueba tu conexión e intenta nuevamente.

`Reintentar` repite restauración/intercambio sin solicitar otra contraseña. Los detalles técnicos pertenecen a diagnóstico de soporte, no a la interfaz final.

## Despliegue seguro

La función vive en `database/lia/supabase/` y debe desplegarse antes del cliente.

- Configurar `SOFIA_SUPABASE_URL` y `SOFIA_SUPABASE_ANON_KEY` como secretos de la función, sin versionar valores.
- Mantener la clave administrativa Lia únicamente en el entorno backend.
- Respetar `verify_jwt = false`: el gateway Lia no puede validar un JWT emitido por SOFIA; el handler lo valida explícitamente contra SOFIA antes de tocar Lia.
- Probar token ausente/inválido, membresía inactiva, cuenta existente, cuenta nueva autorizada y fallo transitorio.
- Probar una cuenta migrada sin `email_confirmed_at` que conserve evidencia legada completa, además de rechazar UUID, correo o fecha divergentes.
- Reconciliar en las cuentas piloto que cada correo pertenezca a la misma persona en SOFIA y Lia antes de habilitar el cliente.
- Confirmar que logs/telemetría no contienen correo, JWT, contraseña, enlace mágico ni `tokenHash`.

No se ejecutó despliegue remoto ni se modificaron secretos durante la implementación local. Publicar función, cargar secretos y liberar cliente requieren HITL.

## Diagnóstico para soporte

| Resultado backend | Interpretación | Acción |
|---|---|---|
| `401 not_authenticated` | sesión SOFIA ausente, inválida o vencida; también evidencia de correo incompleta | revisar restauración/refresh y ejecutar la consulta de cuentas migradas; no tocar contraseñas Lia |
| `403 access_denied` | identidad válida sin membresía activa o política la niega | revisar membresía SOFIA del usuario |
| `503 exchange_unavailable` | configuración o dependencia temporalmente indisponible | revisar secretos, función, SOFIA/Lia y reintentar |
| `200` pero falla `verifyOtp` | token vencido/consumido o Auth Lia indisponible | reintentar intercambio y revisar límites Auth |

### Cuenta migrada desde el Auth legado

La hipótesis principal para una cuenta antigua es que el login por contraseña sí
entrega una sesión, pero la migración no copió `auth.users.email_confirmed_at`.
Ese caso se reprodujo contra el contrato anterior: la función lo trataba como
identidad no autenticada y nunca llegaba a comprobar la membresía ni a generar
acceso a conversaciones. La consulta siguiente debe confirmar o descartar la
hipótesis para el usuario afectado antes de atribuirle la causa productiva.

Ejecutar solo las consultas de lectura de
`database/sofia-learning/migrations/auth-supabase-hub.sql`, sección 2B. Una cuenta
es compatible con la ruta legada únicamente si coinciden UUID y correo, y
`public.users` conserva tanto el booleano como la fecha de verificación. Cualquier
discordancia requiere revisión manual: no se debe marcar el correo como confirmado
por el solo hecho de que exista o tenga un inicio de sesión reciente.

El archivo se ejecuta en el proyecto **SofLIA Learning/SOFIA**, no en
**Pulse Hub/Lia**. El error `relation "public.users" does not exist` significa que
se abrió la instancia de conversaciones; no indica que falte una migración en
Pulse Hub y no debe resolverse creando allí una tabla `users` duplicada.
En SOFIA, el error `column u.password_hash does not exist` corresponde a una
versión obsoleta del diagnóstico: el esquema actual ya retiró esa columna. Use la
versión vigente, que solo compara identidad y confirmación y no inspecciona hashes.

### Identidad SOFIA consistente pero conversaciones no disponibles

Si la consulta SOFIA devuelve el mismo UUID y correo, confirmación vigente y una
sesión reciente, la migración de identidad queda descartada para esa cuenta. No
se deben modificar `public.users`, `auth.users` ni contraseñas para intentar
recuperarla.

Ejecutar entonces `database/lia/audits/federated-chat-account-diagnostic.sql` en
el proyecto **Pulse Hub/Lia**, reemplazando los dos parámetros iniciales por el
UUID y correo obtenidos en SOFIA. La consulta compara por separado ambos valores,
comprueba el perfil operativo y cuenta conversaciones sin modificar datos. La
guarda solo exige `auth.users`, `public.profiles` y `public.conversations`; si
alguna falta, enumera las relaciones ausentes y señala que debe cambiarse al
proyecto Lia. No se deben crear esas tablas en SOFIA.

| Diagnóstico Lia | Interpretación | Acción segura |
|---|---|---|
| `identidad_operativa_consistente` en ambos criterios | Lia conserva la misma identidad | revisar respuesta y logs seguros de la Edge Function; no migrar datos |
| `sin_coincidencia_en_auth_lia` en ambos criterios | la cuenta operativa aún no existe | revisar despliegue/secretos de la función; `generateLink` debe crearla al intercambiar |
| `mismo_correo_con_uuid_distinto` | Lia ya asoció el correo a otro UUID | detener automatismos y reconciliar ownership con revisión humana |
| `mismo_uuid_con_correo_distinto` | el UUID operativo pertenece a otro correo | detener automatismos; no cambiar correo ni UUID desde soporte |
| `auth_lia_sin_perfil` | existe Auth Lia, pero falta su perfil público | revisar el error de `syncLiaProfile`; no impide por sí solo generar la sesión |
| RLS habilitado y cero políticas SELECT/ALL | una sesión válida no podrá listar chats | revisar y probar las políticas versionadas antes de cualquier cambio remoto |

La pantalla de acceso muestra la versión proveniente de `package.json`. Una
captura en v0.8.1 identifica un cliente anterior al código local v0.9.1 de este
arreglo. El orden de recuperación es: desplegar y probar primero
`sofia-session-exchange` en Lia, publicar después el cliente corregido y confirmar
la versión instalada antes de usar **Reintentar**.

Después de publicar este código se debe redesplegar `sofia-session-exchange`; el
botón **Reintentar** recuperará la sesión sin cambiar contraseñas ni tocar el UUID
Lia. La implementación local por sí sola no modifica la función remota.

Rollback: volver al cliente anterior y deshabilitar la función. No existe migración SQL ni cambio de UUID que revertir. El comportamiento de doble contraseña anterior no debe restaurarse como solución permanente.
