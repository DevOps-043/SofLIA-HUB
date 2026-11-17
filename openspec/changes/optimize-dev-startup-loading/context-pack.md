# Contexto del cambio

- Objetivo: reducir el tramo hasta login e identificar la espera atribuida a dotenv.
- Usuario o actor: desarrollador de Soflia Hub mediante npm run dev.
- Alcance: carga de módulos, trabajo accesorio del build dev y métricas de arranque.
- No objetivos: desactivar servicios, cambiar auth, instalar o publicar una versión, prometer un tiempo universal.
- Restricciones: conservar todas las funciones y el registro de IPC antes del renderer; preservar etapas previas en codex/optimize-build-runtime.
- Contratos afectados: exports internos de loadMainServiceModules; logs BOOT. Sin contratos IPC nuevos.
- Riesgo y HITL: orden de evaluación de imports concurrentes; comprobar dependencias compartidas y exports. Sin operaciones críticas sobre datos reales.
- Criterios verificables: todos los imports solicitados antes de esperar uno; loader no resuelve antes de todos y propaga fallo; gzip sólo en build; métricas incluyen evaluación estática; gate y build aprobados.
- Incertidumbres: log original sin timestamps para dotenv; cachés del SO y antivirus influyen; recompilación adicional en investigación.
