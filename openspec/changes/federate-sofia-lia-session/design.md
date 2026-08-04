## Context

Pulse Hub usa dos proyectos Supabase: SOFIA es la identidad principal y Lia almacena conversaciones con RLS ligado a `auth.uid()`. El cliente actual autentica ambos proyectos con el mismo correo y contraseña. Esta duplicación no constituye SSO: una modificación de contraseña en SOFIA no modifica Lia y deja al usuario dentro de la aplicación pero sin acceso al chat.

La corrección cruza autenticación, una Edge Function, el renderer y operación. Debe conservar el UUID Lia ya asociado con conversaciones, evitar cualquier secreto administrativo en Electron y no convertir un fallo secundario en cierre de la sesión principal.

## Goals / Non-Goals

**Goals:**

- Hacer de SOFIA la única autenticación visible.
- Derivar automáticamente una sesión Lia para el mismo correo desde un JWT SOFIA válido.
- Conservar el usuario/UUID Lia existente y crear de forma idempotente únicamente el que falte.
- Fallar de forma cerrada ante identidad inválida o membresía inactiva, y de forma degradada/reintentable ante indisponibilidad.
- Eliminar del cliente el inicio, alta y reparación de Lia mediante contraseña.

**Non-Goals:**

- Fusionar proyectos Supabase o migrar tablas/RLS.
- Cambiar los UUID de usuarios existentes.
- Implementar un proveedor OIDC general para terceros.
- Desplegar la función, cargar secretos o publicar la aplicación sin HITL.

## Decisions

### Intercambio mediante token de un solo uso

Una Edge Function alojada en Lia recibirá `Authorization: Bearer <JWT SOFIA>`. Validará el token y el correo confirmado contra el servicio Auth de SOFIA, comprobará una membresía `organization_users.status = active` del mismo `user.id` y usará el cliente administrativo de Lia para `generateLink(type: magiclink, email)`. Devolverá solo `hashed_token`; el renderer lo canjeará con `verifyOtp(type: magiclink)` para obtener la sesión Lia normal.

`generateLink` conserva el usuario existente por correo y crea el faltante para `magiclink`, por lo que el `sub` Lia usado por RLS permanece estable. El token es breve, de un solo uso y viaja con `Cache-Control: no-store`.

Alternativas descartadas:

- Sincronizar contraseñas: conserva dos fuentes de verdad, requiere conocer credenciales previas y vuelve a divergir.
- Exponer `service_role` en Electron: permitiría eludir RLS y es inaceptable.
- Sustituir `auth.uid()` Lia por el UUID SOFIA de inmediato: exige migrar datos y todas las políticas, con mayor riesgo.
- Enviar un enlace por correo: añade fricción y no resuelve la restauración transparente del escritorio.

### Validación explícita del JWT externo

La verificación JWT del gateway de la función estará desactivada porque el token está firmado por SOFIA, no por Lia. Esto no vuelve pública la capacidad: el handler rechazará cualquier solicitud sin bearer token y llamará a `sofia.auth.getUser(token)` antes de cualquier operación administrativa. La consulta de membresía se ejecutará con el mismo JWT bajo RLS de SOFIA y comparará siempre `user_id` con el sujeto autenticado.

Alternativa descartada: validar el JWT SOFIA con una clave copiada o decodificarlo sin verificación. Eso duplicaría material criptográfico y permitiría aceptar claims no autenticados.

### Contrato mínimo y mensajes no técnicos

La respuesta exitosa será `{ tokenHash }`; los fallos expondrán códigos estables (`not_authenticated`, `access_denied`, `exchange_unavailable`) sin mensajes del proveedor. Los detalles internos solo se registrarán en la función sin incluir tokens ni enlaces. El renderer convertirá cualquier indisponibilidad en “No pudimos cargar tus conversaciones” y ofrecerá “Reintentar”.

### Restauración y reintento

El renderer primero reutilizará una sesión Lia persistida solo si su correo coincide con SOFIA. Si falta o no coincide, cerrará localmente esa sesión y ejecutará el intercambio. El inicio y la restauración de SOFIA seguirán la misma ruta; la contraseña se consume exclusivamente en `signInWithSofia` y se descarta después.

Los fallos de red/5xx tendrán reintentos acotados con espera incremental. Los 401/403 no se reintentarán automáticamente. SOFIA permanecerá activa y las funciones dependientes de conversaciones quedarán bloqueadas hasta reintentar con éxito.

## Risks / Trade-offs

- [Función desplegada con validación del gateway activa] → El JWT SOFIA sería rechazado antes del handler; versionar `verify_jwt = false` y probar un intercambio real antes de liberar el cliente.
- [Endpoint alcanzable sin validación del gateway] → Autenticar obligatoriamente contra SOFIA dentro del handler, negar por defecto y probar token ausente, inválido y membresía inactiva.
- [Secuestro del token de un solo uso] → TLS, respuesta `no-store`, no persistir ni registrar `tokenHash`, canjear inmediatamente y limitar el cuerpo de respuesta.
- [Correo distinto entre proyectos] → El token se genera únicamente para el correo verificado del JWT; nunca se acepta un correo enviado por el cliente.
- [Colisión histórica de correos entre propietarios distintos] → Exigir correo confirmado y reconciliar duplicados/propiedad en una muestra productiva antes de habilitar el cliente.
- [Alta automática no deseada] → Exigir membresía SOFIA activa antes de `generateLink`; la operación es idempotente por correo.
- [Indisponibilidad de SOFIA o Lia] → Mantener la sesión principal, degradar solo conversaciones y permitir reintento.
- [Cliente nuevo contra backend no desplegado] → Desplegar función y secretos primero, probar, luego publicar cliente.

## Migration Plan

1. Configurar en el proyecto Lia los secretos `SOFIA_SUPABASE_URL` y `SOFIA_SUPABASE_ANON_KEY` sin versionar valores.
2. Desplegar `sofia-session-exchange` con `verify_jwt = false` y ejecutar pruebas de rechazo/éxito con una cuenta controlada.
3. Confirmar que una cuenta Lia existente conserva su UUID y accede a sus conversaciones; confirmar alta idempotente para una cuenta autorizada nueva.
4. Auditar que los correos de las cuentas piloto pertenecen a la misma persona en SOFIA y Lia.
5. Publicar el cliente que usa intercambio y observar tasas 401/403/5xx sin registrar tokens.
6. Retirar cualquier documentación/flujo de reparación por contraseña secundaria.

Rollback: revertir el cliente a la versión anterior y deshabilitar/eliminar la función. No hay migración SQL ni cambio de UUID que revertir. El rollback temporal recupera el comportamiento anterior, pero no debe considerarse solución definitiva para divergencia de contraseñas.

## Open Questions

- Antes del despliegue se deben confirmar los nombres definitivos de secretos y los límites de generación/verificación de enlaces del proyecto Lia.
- La observabilidad productiva debe elegir un contador agregado por código/estado que no incluya correo, JWT ni token de un solo uso.
