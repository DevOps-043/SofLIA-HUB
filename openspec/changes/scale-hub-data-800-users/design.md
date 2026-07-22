## Context

SofLIA Hub es una app de escritorio Electron donde cada cliente se conecta
directamente a Supabase (Lia, SOFIA/Learning, IRIS) con clave anónima sobre
PostgREST, usando un fetch resiliente propio (`src/shared/supabase-http.ts`) y un
factory de cliente (`src/lib/supabase-factory.ts`) con `persistSession` y
`autoRefreshToken`. "800 usuarios concurrentes" significa ~800 clientes de
escritorio consultando esas instancias, no un servidor de aplicación intermedio.

Existe trabajo previo: `database/lia/migrations/performance-hardening.sql` y
`database/sofia-learning/migrations/performance-hardening.sql` definen índices por
patrón de acceso. La instancia Lia concentra la ruta caliente operativa (chat,
mensajes, monitoreo, SDO). El realtime del cliente aparece solo en
`src/hooks/chat-manager/useChatRefreshEffects.ts`; hay ~32 usos de `select('*')`
en 21 archivos de `src/`.

## Goals / Non-Goals

**Goals:**

- Convertir la meta de 800 usuarios en un RNF medible y un escenario reproducible.
- Verificar con evidencia que los índices existentes estén aplicados y sean
  suficientes para las consultas reales.
- Auditar y, donde la evidencia lo justifique, mejorar RLS y patrones de consulta
  del cliente.
- Documentar el modelo de conexión/pooling y sus límites como riesgo/operación.

**Non-Goals:**

- Ejecutar SQL remoto o pruebas de carga sin autorización (es HITL/manual).
- Rediseñar el esquema o migrar de backend.
- Prometer una cifra sin la prueba de carga ejecutada.

## Decisions

### RNF medible antes que optimización

Se define un RNF con: usuarios simultáneos objetivo, mezcla de operaciones
representativa (p. ej. abrir chat, listar conversaciones, enviar mensaje, cargar
monitoreo), percentiles de latencia (p95/p99) y tasa de error aceptable. Se
registra en `docs/architecture/runtime-parameters.md`. El estándar §5/§8 exige
esta conversión antes de declarar escalabilidad.

Alternativa descartada: afirmar "soporta 800 usuarios" por el solo hecho de tener
índices. No es evidencia y contradice `docs/standards/database.md`.

### Escenario de carga reproducible con ejecución manual

Se especifica un escenario reproducible: perfil de tráfico, datos de siembra y
procedimiento de ejecución contra un entorno de medición. La ejecución la realiza
un operador con HITL y su resultado se registra fuera del repositorio; el cambio
entrega el diseño y el guion, no una corrida remota no autorizada.

Alternativa descartada: automatizar la prueba contra producción. Prohibido por
seguridad y por el estándar de datos.

### Índices: auditar aplicación y cobertura, no duplicar

Se verifica por instancia que las migraciones `performance-hardening.sql` estén
aplicadas y que sus índices cubran las consultas reales revisando planes
(`EXPLAIN`) que aporte el operador. Los faltantes se proponen como migraciones
nuevas idempotentes (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`) con rollback y
justificación por consulta, evitando sobreindexar escrituras.

### RLS eficiente bajo concurrencia

Se auditan las políticas que invocan funciones de auth por fila. El patrón
escalable es envolver la función en subconsulta (p. ej. `(select auth.uid())`)
para que el planner la evalúe una vez por consulta. Los cambios se entregan como
migración idempotente con rollback y pruebas de que el aislamiento se mantiene
(RLS activo con política correcta, no permisiva).

Alternativa descartada: desactivar RLS para ganar velocidad. Rompe el aislamiento
exigido por el estándar.

### Patrones de consulta del cliente acotados

Se auditan `select('*')`, ausencia de paginación, N+1 y realtime. Donde la
evidencia lo justifique se seleccionan columnas explícitas, se pagina y se limita
el payload, preservando compatibilidad de lectura del renderer y cubriendo con
pruebas. El realtime se revisa para asegurar cierre de canales y evitar
suscripciones que no escalen con 800 clientes.

### Conexión y pooling documentados como límite

Se documenta el modelo de conexión (PostgREST/Supavisor, refresh de sesión,
timeouts y retries del fetch propio) y sus límites conocidos como riesgo y
operación, no como promesa de capacidad.

## Risks / Trade-offs

- [Afirmar 800 sin ejecutar la prueba] → El cambio entrega RNF y escenario; la
  afirmación de cumplimiento queda condicionada a la corrida del operador.
- [Migración de índice/RLS no aplicada realmente] → Verificación operativa con
  evidencia fuera del repo; un `.sql` no cuenta como aplicado.
- [Cambiar columnas/paginación rompe una lectura] → Preservar contrato, migrar con
  compatibilidad y cubrir con pruebas de regresión.
- [Reescribir RLS altera el aislamiento] → Probar SELECT/INSERT/UPDATE/DELETE por
  actor y ownership antes de proponer aplicar.
- [Realtime no escala a 800 clientes] → Medir en el escenario y documentar límite;
  degradar a polling acotado si la evidencia lo exige.

## Migration Plan

1. Definir RNF y escenario reproducible; registrarlos en documentación.
2. Auditar aplicación y cobertura de índices por instancia con planes reales.
3. Auditar RLS y patrones de consulta del cliente; proponer migraciones y ajustes
   con evidencia.
4. Preparar migraciones idempotentes con rollback (sin ejecutar remoto sin
   autorización) y ajustes de consulta con pruebas.
5. El operador ejecuta SQL y prueba de carga con HITL; registrar resultados fuera
   del repositorio y confrontarlos con el RNF.

Rollback: revertir ajustes de consulta del cliente por código; las migraciones de
índice/RLS incluyen su propio rollback. Ninguna aplicación remota ocurre sin
autorización explícita.

## Open Questions

- ¿Qué entorno de medición usará el operador (staging dedicado, réplica) y con qué
  volumen de datos de siembra? Se define con el operador antes de la corrida; el
  escenario se diseña parametrizable.
