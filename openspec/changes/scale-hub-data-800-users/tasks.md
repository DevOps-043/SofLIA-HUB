## 1. RNF y escenario de carga reproducible

- [x] 1.1 Definir el RNF de concurrencia: usuarios simultáneos objetivo, mezcla de operaciones representativa, p95/p99 de latencia y tasa de error aceptable. — `docs/architecture/load-and-scalability.md` (objetivos a validar, no capacidad demostrada).
- [x] 1.2 Registrar el RNF en `docs/architecture/runtime-parameters.md`. — fila "RNF concurrencia (objetivo)".
- [x] 1.3 Especificar el escenario de carga reproducible: perfil de tráfico, datos de siembra y procedimiento de ejecución para un operador (HITL, manual). — `load-and-scalability.md` (escenario + runbook).

## 2. Auditoría de índices existentes

- [ ] 2.1 Verificar por instancia (Lia, SOFIA/Learning) que las migraciones `performance-hardening.sql` estén aplicadas; registrar evidencia fuera del repo. — MANUAL; runbook §1 en `load-and-scalability.md`.
- [ ] 2.2 Revisar con planes reales (`EXPLAIN`) que los índices cubran las consultas calientes; documentar faltantes. — MANUAL; runbook §1.
- [ ] 2.3 Proponer migraciones nuevas idempotentes (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`) con rollback y justificación por consulta, sin sobreindexar escrituras. — Depende de la evidencia `EXPLAIN` de 2.2.

## 3. Auditoría y mejora de RLS

- [x] 3.1 Identificar políticas RLS que reevalúan funciones de auth por fila en las tablas calientes. — `auth.uid()` sin envolver en `monitoring-tables.sql`, `messages-rls-update-policy.sql` y `shared/security-rls-hardening.sql`. Las tablas meetings/SDO usan políticas permisivas a propósito (main con anon key sin sesión; ver `fix-meeting-ops-rls.sql`).
- [x] 3.2 Preparar migración idempotente con rollback que envuelva la función en subconsulta, preservando el aislamiento. — `database/lia/migrations/rls-initplan-optimization.sql`.
- [ ] 3.3 Probar SELECT/INSERT/UPDATE/DELETE por actor, organización y ownership antes de proponer aplicar. — MANUAL; runbook §2.

## 4. Patrones de consulta del cliente

- [x] 4.1 Auditar los ~32 usos de `select('*')` y la ausencia de paginación/N+1 en `src/services/`, `src/adapters/tracking/` y consumidores del chat. — Inventario documentado en `load-and-scalability.md` (sección Auditoría de consultas).
- [ ] 4.2 Acotar columnas, paginar y limitar payloads donde la evidencia lo justifique, preservando el contrato de lectura del renderer. — Diferido: requiere pruebas de regresión de lectura y verificación en runtime.
- [ ] 4.3 Revisar la superficie realtime (`src/hooks/chat-manager/useChatRefreshEffects.ts`): cierre de canales y viabilidad a 800 clientes; degradar a polling acotado si la evidencia lo exige. — Documentado; ajuste diferido a la prueba de carga.

## 5. Conexión, pooling y límites

- [x] 5.1 Documentar el modelo de conexión (PostgREST/Supavisor, refresh de sesión, timeouts/retries del fetch propio) y sus límites conocidos como riesgo/operación. — `load-and-scalability.md` (sección Modelo de conexión).

## 6. Verificación y cierre

- [~] 6.1 Ejecutar `npm run typecheck`, `lint:changed`, `docs:check` y `npm run openspec:validate`. — sin código de app modificado en este incremento; docs y openspec validan (pendiente correr el conjunto completo).
- [ ] 6.2 El operador ejecuta SQL y prueba de carga con HITL; confrontar resultados con el RNF y registrar evidencia fuera del repositorio. — MANUAL.
- [ ] 6.3 Ejecutar `npm run verify:pr`; actualizar documentación de datos/arquitectura. — pendiente.
- [ ] 6.4 Revisión adversarial: promesas sin evidencia, migración no aplicada, RLS que rompe aislamiento, contratos de lectura alterados y rollback; adjuntar evidencia. — pendiente.
