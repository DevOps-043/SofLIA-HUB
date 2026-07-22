## Why

El primer release espera al menos 800 usuarios usando el Hub de forma
simultánea contra las instancias Supabase (Lia, SOFIA/Learning, IRIS). Hoy no
existe un objetivo de carga medible ni una prueba reproducible que sustente esa
cifra. `docs/standards/database.md` y el estándar de ingeniería (§5) prohíben
adoptar una meta de concurrencia como promesa sin convertirla antes en un RNF
medible y un escenario reproducible.

Ya existe trabajo previo de rendimiento que no debe duplicarse:
`database/lia/migrations/performance-hardening.sql` y
`database/sofia-learning/migrations/performance-hardening.sql` crean índices por
patrón de acceso (conversaciones, mensajes, carpetas, comparticiones, monitoreo,
usuarios, organizaciones, learning). Un archivo `.sql` no prueba que la migración
esté aplicada, así que la verificación real es operativa y con HITL.

Los gaps que impiden afirmar soporte a 800 usuarios con evidencia son: (1) no hay
RNF ni escenario de carga reproducible; (2) el rendimiento de RLS bajo
concurrencia no está auditado (una política que reevalúa `auth.uid()` por fila se
degrada a escala); (3) los patrones de consulta del cliente no están auditados —
existen ~32 usos de `select('*')` en 21 archivos de `src/` y una superficie de
realtime en `src/hooks/chat-manager/useChatRefreshEffects.ts`; (4) el modelo de
conexión/pooling (PostgREST/Supavisor) no está documentado como límite conocido.

## What Changes

- Definir un RNF medible de concurrencia (usuarios simultáneos objetivo, mezcla
  de operaciones representativa, p95/p99 de latencia y tasa de error aceptable) y
  registrarlo en `docs/architecture/runtime-parameters.md`.
- Especificar un escenario de carga **reproducible** (perfil de tráfico, datos de
  siembra, cómo ejecutarlo) que un operador pueda correr contra un entorno de
  medición; la ejecución de la prueba y de SQL remoto es manual y con HITL.
- Auditar que las migraciones `performance-hardening.sql` existentes estén
  aplicadas en cada instancia y que sus índices cubran las consultas reales
  (mediante `EXPLAIN`/plan revisado por operador), documentando faltantes.
- Auditar el rendimiento de RLS: identificar políticas que reevalúan funciones de
  auth por fila y proponer la forma escalable (envolver en subconsulta) como
  migración idempotente con rollback, sin ejecutarla sin autorización.
- Auditar patrones de consulta del cliente: `select('*')`, ausencia de paginación,
  N+1 y suscripciones realtime; acotar columnas, paginar y limitar payloads donde
  la evidencia lo justifique.
- Documentar el modelo de conexión/pooling y los límites conocidos de las
  instancias como riesgos u operación, no como promesa.

No objetivos: ejecutar SQL remoto o migraciones destructivas sin autorización;
prometer una cifra de concurrencia sin la prueba de carga ejecutada; rediseñar el
esquema de datos; migrar a otra arquitectura de backend; el arranque de la app
(cubierto por `optimize-startup-fluidity`).

## Capabilities

### New Capabilities

- `hub-data-scalability`: Objetivo de concurrencia medible y verificable para las
  instancias del Hub, con escenario de carga reproducible, índices auditados,
  RLS eficiente y patrones de consulta del cliente acotados.

### Modified Capabilities

Ninguna. No existe un spec base publicado de escalabilidad de datos que este
cambio modifique.

## Impact

Afecta documentación de arquitectura/datos, posibles migraciones nuevas bajo
`database/lia/migrations/` y `database/sofia-learning/migrations/` (RLS/índices
faltantes, idempotentes y con rollback) y adaptadores de consulta del cliente en
`src/services/`, `src/adapters/tracking/` y `src/hooks/chat-manager/`. No agrega
secretos. La ejecución de SQL remoto y de la prueba de carga es manual, con HITL,
y su resultado se registra fuera del repositorio conforme a
`docs/standards/database.md`. Cambiar columnas seleccionadas o paginación puede
alterar contratos de lectura del renderer: se preserva compatibilidad y se cubre
con pruebas.
