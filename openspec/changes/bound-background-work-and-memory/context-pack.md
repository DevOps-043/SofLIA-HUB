# Contexto

- Objetivo: reducir picos de CPU/RAM/IO y carreras de fondo, manteniendo funciones.
- Actor: usuario del Hub con recursos limitados.
- Alcance: captura periódica, índice local de rutas y caché de embeddings.
- No objetivos: cambiar IPC, permisos, esquemas SQLite/Supabase, borrar datos o garantizar un consumo global fijo.
- Restricciones: preservar búsqueda completa sobre las mismas filas, invalidación existente y recuperación al reiniciar servicios.
- Riesgo/HITL: cambios locales reversibles; QA usa capturas y filesystem simulados, sin leer escritorio ni documentos del usuario.
- Criterios: una captura periódica en curso; stop/configuración invalidan publicación; una actualización de rutas, un timer, cuatro consultas de metadatos como máximo; caché de hasta cuatro sesiones y 5000 vectores acumulados sin perder resultados recargables.
- Incertidumbres: tiempos y memoria de proveedores nativos/terceros; no se garantiza detener físicamente una operación que ya empezó.
