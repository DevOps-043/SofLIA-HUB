-- =====================================================================
-- SofLIA Hub - Optimizacion RLS (initplan) para la instancia Lia
-- Instancia: Lia (VITE_SUPABASE_URL).
-- Objetivo: reemplazar `auth.uid()` sin envolver por `(select auth.uid())` en
-- las politicas autenticadas del renderer, para que el planner evalue la funcion
-- UNA vez por consulta (InitPlan) en lugar de una vez por fila. Es una
-- optimizacion de rendimiento; NO cambia la semantica de aislamiento:
-- `(select auth.uid()) = user_id` es equivalente a `auth.uid() = user_id`.
--
-- Precondiciones:
--   - Ejecutar en el SQL Editor de la instancia Lia, con autorizacion (HITL).
--   - Aplica solo a tablas cuyo acceso proviene del renderer autenticado
--     (auth.uid() valido). NO tocar meetings/hub-service-state: usan
--     politicas permisivas por la migracion de auth pendiente.
--   - Idempotente: recrea cada politica con la misma clausula FOR/TO/USING/CHECK,
--     solo envolviendo auth.uid(). Se puede correr varias veces.
--
-- Impacto: ninguna fila cambia; cambian definiciones de politica. Reversible con
-- el bloque de rollback al final (comentado).
--
-- Verificacion posterior sugerida (fuera de este script):
--   EXPLAIN (ANALYZE) SELECT ... -> auth.uid() debe aparecer como InitPlan.
--   Probar SELECT/INSERT/UPDATE/DELETE con actor correcto (permite) y actor
--   equivocado (deniega) antes de darla por buena.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Monitoreo y conexiones OAuth (renderer autenticado)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own monitoring sessions" ON public.monitoring_sessions;
CREATE POLICY "Users manage own monitoring sessions"
  ON public.monitoring_sessions
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own activity logs" ON public.activity_logs;
CREATE POLICY "Users manage own activity logs"
  ON public.activity_logs
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own daily summaries" ON public.daily_summaries;
CREATE POLICY "Users manage own daily summaries"
  ON public.daily_summaries
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users manage own calendar connections"
  ON public.calendar_connections
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Mensajes de chat: UPDATE y DELETE (INSERT/SELECT ya existentes se dejan
-- intactas; recrearlas requiere conocer su clausula exacta en la instancia).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Usuarios pueden actualizar mensajes de sus conversaciones" ON public.messages;
CREATE POLICY "Usuarios pueden actualizar mensajes de sus conversaciones"
  ON public.messages
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuarios pueden eliminar mensajes de sus conversaciones" ON public.messages;
CREATE POLICY "Usuarios pueden eliminar mensajes de sus conversaciones"
  ON public.messages
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Verificacion: listar politicas resultantes de las tablas afectadas.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('monitoring_sessions', 'activity_logs', 'daily_summaries', 'calendar_connections', 'messages')
ORDER BY tablename, cmd;

-- =====================================================================
-- ROLLBACK (descomentar y ejecutar para volver a auth.uid() sin envolver):
-- =====================================================================
-- DROP POLICY IF EXISTS "Users manage own monitoring sessions" ON public.monitoring_sessions;
-- CREATE POLICY "Users manage own monitoring sessions" ON public.monitoring_sessions
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Users manage own activity logs" ON public.activity_logs;
-- CREATE POLICY "Users manage own activity logs" ON public.activity_logs
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Users manage own daily summaries" ON public.daily_summaries;
-- CREATE POLICY "Users manage own daily summaries" ON public.daily_summaries
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Users manage own calendar connections" ON public.calendar_connections;
-- CREATE POLICY "Users manage own calendar connections" ON public.calendar_connections
--   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Usuarios pueden actualizar mensajes de sus conversaciones" ON public.messages;
-- CREATE POLICY "Usuarios pueden actualizar mensajes de sus conversaciones" ON public.messages
--   FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- DROP POLICY IF EXISTS "Usuarios pueden eliminar mensajes de sus conversaciones" ON public.messages;
-- CREATE POLICY "Usuarios pueden eliminar mensajes de sus conversaciones" ON public.messages
--   FOR DELETE TO authenticated USING (auth.uid() = user_id);
