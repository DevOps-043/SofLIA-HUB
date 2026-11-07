# Contexto del cambio

- Objetivo: una intención de acceso/cierre vigente por AuthProvider, compartida por restauración/eventos, login, SSO y reintentos; impedir publicación y siguientes efectos de intenciones superadas.
- Usuario o actor: persona que inicia/cancela acceso, cambia cuenta o cierra sesión con SDK/consultas pendientes.
- Alcance: coordinador privado de intenciones y cola de mutaciones SDK, hooks Auth, guardas de servicio SOFIA/SSO/Lia/directorio y publicación existente hacia main.
- No objetivos: contratos SQL, RLS/JWT, revocar físicamente HTTP ya enviado, arbitraje entre procesos/equipos, claves compartidas del bundle, canales IPC nuevos o UI visual.
- Restricciones: rama acumulativa codex/reduce-technical-debt; preservar todos los cambios y otros worktrees. Sin secretos/.env, stage/commit/push, SQL, cuentas/red reales, instalador o despliegue. No archivar sin revisión independiente.
- Contratos afectados: AuthContext público conserva métodos y DTO; funciones privadas reciben coordinador/señal. auth:set-state conserva servicio/handler/preload/wrapper y payload. Se publica revocación sin esperar SDK al cerrar/cambiar intención; nunca desde el orbe.
- Riesgo y HITL: riesgo alto de autenticación. Probar promesas y SDK ficticios antes de integrar, mantener pruebas consumidoras y verificación completa congelada. No ejecutar autenticaciones o cierres reales.
- Criterios verificables: nuevo intento/cierre invalida antes del primer await; resultados/catch/finally antiguos no publican; A/B/A; callbacks SDK del propio login no lo cancelan; cierre externo sí revoca; mutaciones SDK locales no solapan; SSO cancelado no abre navegador/canje/OTP posterior; retries no publican contexto ajeno; cleanup/StrictMode liberan recursos; éxito/degradación vigentes compatibles; revocación main no espera lectura de tokens.
- Incertidumbres: un SDK ya enviado puede persistir antes de devolver; la cola espera su final para iniciar otra mutación local. Identidad del perfil SOFIA no se presume equivalente a UUID Auth: las observaciones del SDK se comparan con session.user.id, no con preferencias ni ID de perfil.
