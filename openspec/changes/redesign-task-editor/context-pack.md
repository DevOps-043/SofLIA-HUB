# Contexto del cambio

- Objetivo: crear y editar tareas en una ventana modal legible, con fases del tablero, inicio y recursos vinculados.
- Actor: integrante autorizado del proyecto y organización activos.
- Alcance: editor modal, estados reales/personalizados y fases ausentes, inicio, enlaces clasificados como foto, documento, página o chat del equipo.
- No objetivos: enviar mensajes, conceder acceso a recursos, copiar archivos, cargar binarios ni migrar chats personales.
- Restricciones: conservar los cambios existentes del tablero, permisos, confirmación main y resultados inciertos. Se trabaja en `codex/task-editor-modal` sobre el worktree actual porque la implementación base de esta área aún no está guardada en commits; no se resetea ni traslada trabajo ajeno.
- Contratos: ampliar createTask/updateTask existentes con started_at, external_links y status_stage. Persistencia IRIS existente; no nuevos canales ni migraciones.
- Riesgo y HITL: fases ausentes afectan al equipo; sólo sus administradores o administradores del workspace pueden materializarlas durante una escritura confirmada. Consultar opciones no escribe.
- Criterios: ventana centrada sin desplazar tablero; teclado/Escape/foco; siete fases y estados personalizados; guardar inicio y recursos en la misma fila; fechas inválidas/URLs inseguras rechazadas; lectores sin acciones; cancelación/error conserva borrador; incertidumbre impide repetir.
- Incertidumbres: RLS del entorno real puede rechazar escritura de estados. No se declara SQL aplicado ni acceso remoto probado. started_at se captura como fecha y se serializa a medianoche UTC, conservando la hora original al editar sin cambiar fecha.
