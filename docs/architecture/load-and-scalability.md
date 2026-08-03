# Carga y escalabilidad de datos

Estado: vigente. Actualizado: 2026-07-21.

Convierte la meta de "800 usuarios concurrentes" en un requisito no funcional
(RNF) medible y define un escenario de carga reproducible. Ninguna cifra de este
documento es una capacidad demostrada: son objetivos a validar con la prueba de
carga ejecutada por un operador. Ver el cambio
`openspec/changes/scale-hub-data-800-users`.

<!-- evidence: database/lia/migrations/performance-hardening.sql -->
<!-- evidence: database/sofia-learning/migrations/performance-hardening.sql -->
<!-- evidence: database/lia/migrations/rls-initplan-optimization.sql -->
<!-- evidence: src/shared/supabase-http.ts -->
<!-- evidence: src/lib/supabase-factory.ts -->

## Modelo de conexión

Pulse Hub es una app de escritorio Electron. Cada cliente se conecta
directamente a Supabase (Lia, SOFIA/Learning, IRIS) con la clave anónima sobre
PostgREST/HTTPS. "800 usuarios concurrentes" significa ~800 clientes de escritorio
consultando esas instancias, no un servidor de aplicación intermedio.

- El **renderer** entra autenticado (sesión Supabase Auth con JWT persistida por
  `src/lib/supabase-factory.ts`), por lo que `auth.uid()` es válido y la RLS por
  usuario aplica en sus consultas.
- El **proceso main** entra con la anon key **sin** sesión Auth para algunos
  flujos (p. ej. meetings/SDO): ahí `auth.uid()` es null y las tablas usan
  políticas permisivas explícitas hasta que concluya la migración de auth (ver
  `database/lia/migrations/fix-meeting-ops-rls.sql`). El aislamiento de esas
  tablas es a nivel de aplicación, no de RLS.
- El fetch propio (`src/shared/supabase-http.ts`) aplica timeout 25 s, 2 retries
  solo para lecturas idempotentes y backoff con jitter.

Límite conocido: PostgREST y el pooler de Postgres acotan las conexiones activas.
Con 800 clientes, la presión se concentra en consultas lentas y suscripciones
realtime, no en el número de sockets HTTP. Este documento las acota; el número
efectivo se confirma con la prueba de carga.

## RNF de concurrencia (objetivos a validar)

Estos valores son objetivos del primer release, no capacidad demostrada. Se
validan/ajustan con la prueba de carga y la telemetría real.

| Dimensión | Objetivo | Nota |
|---|---|---|
| Usuarios simultáneos | 800 activos | Primer release |
| Latencia lectura p95 / p99 | < 400 / < 800 ms | En el borde del cliente, red incluida |
| Latencia escritura p95 | < 600 ms | Upsert de mensaje, activity logs |
| Tasa de error | < 0.5 % | Excluye reintentos idempotentes exitosos |
| Saturación de plan | 0 secuencial en consultas calientes | Confirmar con `EXPLAIN` |

Mezcla de operaciones representativa (a ajustar con telemetría; punto de partida):

- 60 % lecturas: listar conversaciones/carpetas, cargar mensajes de una
  conversación, resumen diario y sesiones de monitoreo.
- 30 % escrituras: upsert de mensaje (chat), inserción de activity logs.
- 10 % otras: comparticiones, ajustes, fuentes de workspace.

## Escenario de carga reproducible

Objetivo: reproducir el RNF de forma controlada contra un **entorno de medición**
(staging o réplica), nunca producción sin autorización.

1. **Datos de siembra**: N usuarios de prueba (objetivo 800) en la instancia de
   medición, cada uno con un conjunto realista: ~20 conversaciones, ~50 mensajes
   por conversación, ~500 activity logs, ~30 resúmenes diarios. Sembrar con un
   script parametrizable por `N_USUARIOS` y volúmenes.
2. **Perfil de tráfico**: reproducir la mezcla 60/30/10 anterior por usuario
   virtual, con think-time entre operaciones (p. ej. 3–10 s) para simular uso
   humano, no un flood.
3. **Rampa**: escalar de 0 a 800 usuarios virtuales en escalones (p. ej. 100 cada
   30 s) para observar el punto donde p95/p99 o la tasa de error superan el RNF.
4. **Métricas a capturar**: p50/p95/p99 por tipo de operación, tasa de error,
   `pg_stat_statements` (consultas más costosas), planes `EXPLAIN (ANALYZE)` de
   las consultas calientes, conexiones activas y espera de pooler.
5. **Criterio de aprobación**: el RNF se cumple si, a 800 usuarios sostenidos, se
   respetan los umbrales de latencia y error sin planes secuenciales en consultas
   calientes.

La ejecución de siembra, prueba de carga y cualquier SQL remoto es **manual y con
HITL**. El resultado se registra fuera del repositorio y se confronta con el RNF.

## Runbook del operador

Ejecución manual con autorización explícita. Registrar evidencia fuera del repo.

### 1. Auditar índices existentes

Las migraciones `database/lia/migrations/performance-hardening.sql` y
`database/sofia-learning/migrations/performance-hardening.sql` definen índices por
patrón de acceso. Un archivo `.sql` no prueba que estén aplicados.

- Confirmar aplicación por instancia:
  `SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname;`
- Para cada consulta caliente (listar conversaciones por `user_id, updated_at`;
  cargar mensajes por `conversation_id, created_at`; activity logs por
  `user_id, timestamp`), revisar el plan:
  `EXPLAIN (ANALYZE, BUFFERS) <consulta>;` y confirmar uso de índice, no scan
  secuencial.
- Documentar faltantes y proponerlos como migración idempotente
  (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`) con justificación por consulta.

### 2. Optimizar RLS (initplan) sin cambiar semántica

Las políticas autenticadas de la instancia Lia usan `auth.uid() = user_id` sin
envolver, lo que reevalúa la función por fila y se degrada a escala. La migración
preparada `database/lia/migrations/rls-initplan-optimization.sql` las recrea con
`(select auth.uid())`, evaluada una vez por consulta, preservando el aislamiento.

- Revisar la migración, ejecutarla con HITL y confirmar con `EXPLAIN` que
  `auth.uid()` aparece como `InitPlan` (una vez), no por fila.
- Validar aislamiento: SELECT/INSERT/UPDATE/DELETE con el actor correcto y con un
  actor equivocado (debe denegar) antes de darla por buena.
- No tocar las políticas permisivas de meetings/SDO: dependen de la migración de
  auth pendiente.

### 3. Ejecutar la prueba de carga

Sembrar el entorno de medición, correr el escenario y capturar métricas.
Confrontar con el RNF y registrar el resultado.

## Auditoría de consultas del cliente

Hallazgos en `src/` a acotar donde la evidencia lo justifique, preservando el
contrato de lectura del renderer:

- ~32 usos de `select('*')` en 21 archivos (p. ej.
  `src/adapters/tracking/supabase-tracking/`, `src/services/chat/remote/`,
  `src/services/share/`). Acotar columnas y paginar las lecturas de listas y de
  mensajes, que crecen con el uso.
- Realtime: `src/hooks/chat-manager/useChatRefreshEffects.ts` es la única
  superficie. Verificar cierre de canales y viabilidad a 800 clientes; degradar a
  polling acotado con intervalo y cancelación si la prueba de carga lo exige.

Estos ajustes se implementan con pruebas de regresión de lectura y no forman
parte del entregable de diseño de este incremento.
