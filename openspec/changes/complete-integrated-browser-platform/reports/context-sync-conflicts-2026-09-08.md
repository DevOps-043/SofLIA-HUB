# Contexto: reconciliación de sincronización (7.4)

- Objetivo: conservar cambios concurrentes y decisiones manuales sin sobrescritura silenciosa.
- Usuario o actor: titular del perfil; la lógica vive en main y no concede herramientas al agente.
- Alcance: algoritmo de tres vías para las cuatro categorías permitidas, revisión identificada por contenido/versiones y diario cifrado local reabrible. Rebasing tras otro conflicto CAS.
- No objetivos: cliente remoto, aplicación a stores activos, IPC/UI, activación de sync, sincronizar contraseñas o aplicar SQL remoto; corresponden a tareas distintas.
- Restricciones: base común explícita, esquemas cerrados compartidos con cifrado, URLs sin query/fragmento, sin desempatar por reloj del dispositivo ni truncar datos.
- Contratos afectados: `sync-crypto.ts`, motor `sync-conflicts.ts`, diario `sync-conflict-store.ts`; sin canales nuevos, dependencias ni cambios SQL.
- Riesgo y HITL: una decisión puede descartar una variante. El motor sólo admite elecciones local/remoto ligadas a la revisión; la futura UI deberá recoger consentimiento. Ningún adaptador aplica resultados todavía. Sólo retirar el pendiente tras commit remoto y local confirmado.
- Criterios verificables: cambios independientes combinados; mismo campo, colisión de ID y borrado/edición conservados; ausencia distinta de null; orden estable; cuotas; rechazo de decisiones ajenas/obsoletas; reinicio conserva revisión/selección; error de E/S y corrupción no reemplazan el principal; perfil y contexto capturados.
- Incertidumbres: integración con Auth Lia y CAS real, relaciones entre categorías, semántica de carpetas que no viajan en el esquema actual y concurrencia con edición local durante la revisión quedan para adaptadores de 7.3. No inventar una base vacía si falta la última instantánea confirmada.
