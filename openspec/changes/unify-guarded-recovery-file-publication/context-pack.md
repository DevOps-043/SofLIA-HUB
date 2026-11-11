# Contexto del cambio

- Objetivo: compartir publicación síncrona de recuperación y conservar el fallo primario frente a errores secundarios de cierre/limpieza.
- Usuario o actor: persona que confirma una recuperación local del navegador; servicios de historial, auditoría, memoria y sync.
- Alcance: primitiva interna de temporal exclusivo, escritura/fsync/cierre, guarda y rename/link; tres motores consumidores, pruebas y arnés nativo.
- No objetivos: refactor de todos los accesos a disco, convertir APIs síncronas a asíncronas, retención/borrado deliberado, formato/cifrado, IPC, SQL remoto, reintentos síncronos o durabilidad eléctrica.
- Restricciones: conservar 28 unidades y trabajo ajeno en codex/reduce-technical-debt; los otros worktrees no contienen este estado acumulado y no se modifican. Sin secretos/.env, cuentas, perfiles reales, commit o publicación.
- Contratos afectados: sólo publicación privada de archivos de recuperación; guardas/consumo/plazo y marcador sync siguen siendo de sus motores. Un fallo de cierre impide publicar; sólo se limpia un temporal efectivamente creado.
- Riesgo y HITL: confirmación existente sin cambios. Éxito público ya comprometido no se revierte por cleanup; fallo primario conserva identidad. Residuos y cierre ambiguo requieren diagnóstico estático, sin paths/datos libres.
- Criterios verificables: reproducir error oculto por unlink/close en consumidores antes de cambiar; probar orden, permisos, guardas, archivos ocupados y etapas de fallo; integrar tres consumidores sin duplicar la publicación; comprobar parcialidad sync/rollback y archivos reales en Electron; gate/build con fuentes estables.
- Incertidumbres: cierre fallido puede haber liberado o conservado descriptor; no se reintenta un descriptor numérico de estado incierto. No hay bloqueo multiproceso ni verificación nativa Linux/macOS. Revisión independiente pendiente, sin archivar.
