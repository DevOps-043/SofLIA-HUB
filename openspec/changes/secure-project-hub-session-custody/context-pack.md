# Contexto del cambio

- Objetivo: reducir deuda de custodia/autenticación de Project Hub sin separar sus consumidores.
- Actor: usuario SOFIA autenticado en main, API Project Hub v1 y consumidores de proyectos/reuniones.
- Evidencia: sesión global sin propietario, safeStorage síncrono, restore implícito antes de login, refresh/logout y canjes sin revisión, redirect de fetch por defecto y replay de mutaciones tras 401.
- Alcance: store asíncrono por propietario con formato versionado, contexto invalidable, controlador de autenticación, transporte acotado y errores seguros; conservar fachada del servicio y cuatro capas IPC existentes.
- No objetivos: inventar endpoint de borrado, migrar RLS IRIS, cambiar identidad del backend, activar despliegue ni declarar resueltas las guardas/HITL de todos los handlers. Esa frontera seguirá una unidad propia después de fijar la custodia.
- Restricciones: once unidades anteriores preservadas; sin secretos/.env/perfiles reales ni efectos remotos. Contrato externo consultado sólo como código local/documentación, no como evidencia de despliegue.
- Contratos: token SOFIA entregado por auth:set-state después de verificar identidad; rutas exchange/refresh/logout existentes. Access token en memoria; refresh/workspaces cifrados y ligados al usuario main. Métodos de servicio y formatos públicos conservados.
- Riesgos: legado sin dueño no puede adjudicarse; requiere nuevo canje usando sesión SOFIA. Fallo de persistencia permite sesión sólo en memoria; no fallback plano. Revocación remota best effort, sin prometer invalidación inmediata de JWT ni políticas del servidor.
- Criterios: A/B/A, logout/canje/refresh tardíos no escriben ni reactivan otro contexto; refresh single-flight vigente, sin sesión no restaura/red; no replay de mutación; redirect credencial bloqueado; cuerpo/envelope acotados; error remoto sin payload; OS real en perfil temporal y regresiones de consumidores.
- Baseline: 19 casos en config/handlers/auth-state, salida 0. Logs bajo %TEMP%/soflia-project-session-2026-10-22/.
