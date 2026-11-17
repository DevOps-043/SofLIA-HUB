# Contexto del cambio

- Objetivo: reducir trabajo redundante de compilación y riesgos de saturación durante respaldos.
- Usuario: desarrolladores y usuarios de equipos con RAM limitada.
- Alcance: dependencias Zoom, tipos incrementales, catálogo Google, observación de archivos, carga diferida de ajustes/productividad y scheduler de respaldos.
- No objetivos: modificar permisos, credenciales, datos remotos o publicar instaladores; prometer ausencia de todos los crashes.
- Restricciones: conservar controles de calidad y contratos IPC; sin nuevas dependencias.
- Contratos afectados: preparación local de build y planificación interna; APIs públicas sin cambios.
- Riesgo y HITL: cambios reversibles locales autorizados; no ejecutar respaldos reales ni operaciones Google.
- Criterios verificables: reutilizar instalación válida; reparar instalación incompleta; conservar typecheck; respaldos de 30 días sin disparo anticipado, sin solapamiento y sin reactivarse tras stop.
- Incertidumbres: faltan dumps y escenarios de los cierres reportados; no hay medición en otros equipos.
