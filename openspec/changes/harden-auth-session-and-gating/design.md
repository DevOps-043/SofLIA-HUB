## Context

La autenticación del producto usa SOFIA (`src/services/sofia-auth.ts`): el login
valida contra Supabase Auth y guarda una sesión sintética en localStorage
(`sofia-session`). `useAuthLifecycle` restaura esa sesión al arrancar y resuelve
el contexto (organización/equipos) con `useSofiaResolver`. Hoy un fallo del
resolver termina en `signOut()`.

El proceso main desconoce el estado de auth. La orbe se crea en
`orb-window-controller.ts` por wake word (`pythonRuntimeService.on('wake-word')`),
atajo `Ctrl+M` o tray. WhatsApp autoconecta en `startup.ts`. Computer-use y
desktop-agent registran handlers IPC que ejecutan acciones sin comprobar sesión.

## Goals / Non-Goals

**Goals:**

- Conservar la sesión entre reinicios y ante fallos transitorios de SOFIA.
- Que el main tenga un estado de auth confiable y niegue por defecto.
- Gatear orbe, WhatsApp, computer-use y desktop-agent hasta sesión válida.
- Revocar acceso y cerrar la orbe al cerrar sesión.

**Non-Goals:**

- Rediseñar login o identidad SOFIA.
- Migrar el acceso del main a Supabase Auth con sesión propia.
- Cambiar catálogo de modelos.

## Decisions

### Persistencia: degradar en vez de cerrar sesión ante error recuperable

`resolveSofiaContext` distinguirá dos resultados: denegación real (perfil válido
sin membresía activa, credenciales inválidas) vs. error recuperable (excepción de
red/timeout). Solo la denegación real cierra sesión. El error recuperable
conserva la sesión persistida, marca `liaDegraded`/estado y reintenta (backoff),
reutilizando el patrón de degradación existente para Lia.

Alternativa descartada: reintentar indefinidamente sin degradar. Oculta el fallo
y puede dejar al usuario sin contexto sin señal.

### Estado de auth conocido por el main vía IPC gobernado

Se agrega un canal `auth:set-state` (renderer → main) que publica un estado
mínimo y no sensible: `{ authenticated: boolean, userId?: string }`, y
`auth:get-state` para que superficies del main lo consulten. El renderer lo emite
al iniciar sesión, al cerrarla y al restaurar. El main mantiene el estado en un
store de proceso; su valor inicial es `no autenticado` (deny-by-default) hasta
recibir el primer `auth:set-state`. El canal cruza servicio, handler
`ipcMain.handle`, allowlist de preload y wrapper tipado del renderer, valida
payload y no transporta tokens ni PII más allá del `userId`.

Alternativa descartada: leer localStorage desde el main. Rompe el aislamiento y
duplica la fuente de verdad; el renderer es el dueño de la sesión.

### Deny-by-default en las superficies del main

Un guard central (`requireAuthenticated`) consulta el store de auth antes de:

- crear/mostrar la orbe (wake word, atajo, tray);
- autoconectar y ejecutar acciones de WhatsApp;
- ejecutar handlers de computer-use y desktop-agent que producen efectos.

Sin sesión, la operación se rechaza con un resultado tipado (p. ej.
`auth_required`) y sin efectos. Al recibir `authenticated:false` (logout), el main
cierra/oculta la orbe y detiene superficies activas. Las lecturas puramente
informativas sin datos del usuario pueden quedar fuera del guard, documentado
caso por caso.

Alternativa descartada: gatear solo en el renderer. No cubre wake word, atajo,
tray ni autoconexión, que nacen en el main.

### Arranque: no revelar funciones antes de conocer el estado

En el arranque, el main asume `no autenticado`. La autoconexión de WhatsApp y la
respuesta a wake word quedan diferidas hasta que el renderer publique
`authenticated:true`. Esto se alinea con el arranque por fases de
`optimize-startup-fluidity` sin depender de él.

## Risks / Trade-offs

- [Gatear de más bloquea uso legítimo] → Estado de auth observable y degradación
  explícita; pruebas de camino permitido y denegado; el renderer publica el
  estado apenas restaura la sesión.
- [Renderer comprometido falsifica el estado] → El estado no otorga privilegios de
  datos (RLS sigue aplicando en Supabase con el JWT del renderer); el gate del
  main protege acciones nativas, no reemplaza la autorización de datos.
- [Fallo transitorio marcado como denegación] → Clasificar por tipo de error;
  solo "sin membresía" y "credenciales inválidas" cierran sesión.
- [Carrera arranque/estado] → Deny-by-default hasta el primer `auth:set-state`;
  la orbe por wake word se difiere si no hay sesión.
- [Logout deja superficies activas] → Al `authenticated:false`, cerrar orbe y
  detener autoconexión; prueba de revocación.

## Migration Plan

1. Corregir la persistencia (clasificación de error, no cerrar sesión ante
   recuperable) con pruebas del lifecycle.
2. Añadir el canal IPC de estado de auth (servicio, handler, preload, wrapper) y
   el store del main con deny-by-default.
3. Publicar el estado desde el renderer en login/logout/restauración.
4. Insertar el guard en orbe, WhatsApp, computer-use y desktop-agent; revocar al
   logout.
5. Pruebas de camino permitido/denegado, tipos, lint, `verify:pr` y revisión
   adversarial.

Rollback: el guard y el canal se pueden desactivar con una bandera que restablece
el comportamiento previo (sin gate en main); la corrección de persistencia es
independiente y de bajo riesgo.

## Open Questions

- ¿Qué superficies de computer-use/desktop-agent son puramente informativas y
  quedan fuera del guard? Se enumeran al implementar, revisando cada handler; por
  defecto entran al guard (deny-by-default).
