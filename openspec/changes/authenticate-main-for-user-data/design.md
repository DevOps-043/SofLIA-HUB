## Context

Ver `proposal.md` — Why. Lo que condiciona el enfoque:

- `electron/hub-db-client.ts` crea un cliente con la anon key y
  `persistSession: false`, `autoRefreshToken: false`. Nunca llama a `setSession`.
- `electron/main/auth-state.ts` mantiene `{authenticated, userId}` y su
  contrato dice explícitamente *"no se aceptan tokens ni datos personales"*.
  Este cambio revierte esa decisión a propósito, así que hay que sustituirla por
  otra guarda, no simplemente borrarla.
- El renderer ya tiene la sesión completa en `useAuthProviderModel`
  (`state.session`) y ya publica al main en cada cambio.
- Los agentes de WhatsApp y Telegram corren **sin ventana**. Cualquier solución
  que dependa de que el renderer esté vivo no sirve.
- `hub_service_state` lo comparten otros servicios (plantillas, meetings). No se
  puede endurecer su política sin romperlos.
- `safeStorage` ya se usa en cuatro sitios del repo con el mismo patrón
  (`memory/token-store.ts` es el más limpio).

## Goals / Non-Goals

**Goals**

- Que `auth.uid()` funcione desde main, sin ventana abierta.
- Que la credencial no salga nunca del proceso main ni aparezca en un log.
- Que las Skills pasivas tengan dueño y no se pisen entre usuarios.
- Que una caída de red no apague las rutinas ya programadas.

**Non-Goals**

- Sesión colaborativa o multiusuario simultánea en el mismo proceso: main opera
  como **un** usuario, el que tiene sesión.
- Endurecer `hub_service_state` para el resto de sus consumidores.

## Decisions

### D1. Main recibe los tokens del renderer, no credenciales del usuario

**Decisión**: el renderer publica `access_token` y `refresh_token` por
`auth:set-state`. Main no conoce contraseña ni realiza login por su cuenta.

**Por qué**: el renderer ya es el dueño de la sesión y ya la publica. Añadir un
login propio en main duplicaría el flujo de autenticación —incluido el SSO
federado— y crearía un segundo sitio donde equivocarse. Pasar tokens ya emitidos
mantiene un solo punto de autenticación.

**Alternativa descartada**: clave `service_role` en main. Funciona sin sesión y
es mucho más simple, pero pone una llave maestra en cada instalador: quien
extraiga el `.env` lee y escribe los datos de **todos** los usuarios. El
aislamiento pasaría a depender de que el código filtre bien por `user_id`, que
es exactamente lo que RLS existe para no tener que confiar.

**Consecuencia**: `auth:set-state` deja de ser un canal inocuo. Se separa en dos
piezas: el estado observable (`{authenticated, userId}`, que el renderer puede
volver a leer) y la credencial (que entra y nunca sale).

### D2. Se guarda el refresh token, no el access token

**Decisión**: en disco solo va el `refresh_token`, cifrado con `safeStorage`. El
`access_token` vive en memoria y lo renueva el cliente.

**Por qué**: el access token dura minutos; persistirlo no sirve para arrancar en
frío. El refresh token es el que permite que WhatsApp funcione tras un reinicio
sin que el usuario abra la aplicación, que es el requisito real. Guardar menos y
que caduque solo es preferible a guardar ambos.

**Guarda**: si `safeStorage.isEncryptionAvailable()` es falso, **no se escribe
nada**. El patrón existente en `memory/token-store.ts` cae a texto plano en ese
caso; aquí no se copia esa parte, porque un refresh token en claro en `userData`
es una credencial de larga vida legible por cualquier proceso del equipo. Se
acepta perder la persistencia antes que degradar el secreto en silencio.

### D3. La sesión se restaura antes de inicializar servicios

**Decisión**: `restoreHubSession()` se ejecuta en el arranque, antes de
`initializeMainServices`, y se espera su resultado.

**Por qué**: `taskScheduler.init()` carga y levanta los cron al arrancar. Si la
sesión llegara después, esa carga se haría como `anon` y las reglas del usuario
no existirían para ella. Es la misma razón por la que el catálogo se resuelve
tarde y no en el arranque.

**No bloquea**: un fallo de red o un token rechazado dejan a main como `anon` y
el arranque continúa. La aplicación funciona degradada, nunca detenida.

### D4. Tabla propia para las Skills pasivas, con el JSON local como caché

**Decisión**: `public.passive_skills` con `(user_id, id)` y RLS por `auth.uid()`.
`scheduler-state.json` se conserva, pero pasa a contener **solo** las reglas del
usuario activo y a reescribirse desde la base cuando ésta responde.

**Por qué no dejar solo la base**: `node-cron` tiene que levantar las
programaciones en el arranque. Si dependiera de una consulta, un arranque sin red
dejaría al usuario sin sus rutinas —y una rutina que no se ejecuta no avisa de
que no se ejecutó—.

**Por qué no dejar solo el archivo**: es lo que hay hoy, y no tiene dueño.

**Orden de precedencia**: la base manda cuando responde. Al leerla con éxito se
reescribe el archivo. Con la base caída se usa el archivo. Es la misma asimetría
que ya rige el catálogo del sistema.

**Cambio de usuario**: al cambiar `userId`, el archivo se vacía y se vuelve a
poblar. Sin eso, las rutinas del usuario anterior seguirían disparándose.

### D5. La migración la hace el dueño, no un operador

**Decisión**: al restaurarse la sesión, si `hub_service_state` todavía tiene la
fila `task-scheduler`, se insertan en `passive_skills` las reglas cuyo
`requestedBy`/`phoneNumber` corresponda a ese usuario, marcándolas con su `id`
original para que `ON CONFLICT DO NOTHING` haga la operación idempotente.

**Por qué así**: nadie más puede saber de quién es cada regla. El campo que las
identifica es el teléfono o el `requestedBy`, y sólo con la sesión iniciada se
puede resolver a qué usuario corresponde. Un script de operador tendría que
adivinarlo.

**Reglas sin dueño resoluble**: se dejan donde están y se registran. No se
atribuyen a quien esté mirando, que sería la forma más fácil de entregarle a
alguien las rutinas de otro.

## Risks / Trade-offs

- **[Main custodia una credencial de larga vida]** → Cifrada con `safeStorage`;
  no se escribe si no hay cifrado (D2); no vuelve al renderer; se borra al
  cerrar sesión; nunca se registra.
- **[El canal `auth:set-state` pasa a transportar un secreto]** → Sigue siendo
  `renderer → main` únicamente. El canal de lectura (`auth:get-state`) devuelve
  solo el estado observable, y hay una prueba que lo fija.
- **[Un token robado del disco vale hasta que se revoque]** → Es el mismo riesgo
  que ya asume el renderer al persistir su sesión. Se acota guardando solo el
  refresh token y borrándolo en el cierre de sesión.
- **[La caché local podría quedar desincronizada]** → La base manda cuando
  responde y la caché se reescribe en cada lectura correcta. El peor caso es una
  rutina que se ejecuta una vez de más tras borrarla sin red.
- **[Migración que atribuye mal una regla]** → Solo migra lo que puede resolver;
  lo demás se queda y se registra (D5).

## Migration Plan

1. Ejecutar `passive-skills.sql` en la instancia Pulse Hub (idempotente).
2. Publicar la versión. En el primer inicio de sesión de cada usuario, sus reglas
   se migran solas desde `hub_service_state`.
3. La fila `task-scheduler` de `hub_service_state` se conserva durante una
   versión como red de seguridad; se retira después.
4. **Rollback**: revertir la versión devuelve el espejo global, que sigue
   intacto. `DROP TABLE public.passive_skills` deja el producto donde estaba.
