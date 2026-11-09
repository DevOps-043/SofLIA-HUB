# Contexto del cambio

- Objetivo: continuar reducción con la frontera nativa completa Desktop Agent.
- Actor: Hub/Orbe registrados y usuario main vigente. Modelo no concede permiso.
- Alcance: 23 canales, schemas cerrados, HITL nativo para efectos, lecturas y
  controles autorizados, cancelación de tareas/observación y teclas sin código
  arbitrario. Configuración validada y publicada sólo tras persistir.
- No objetivos: verificar GUI real, RLS/JWT servidor, custodia general de claves,
  arbitraje de todos los drivers o ownership de eventos/memoria runtime internos.
- Restricciones: conservar cuatro capas, canales, funcionalidades y trabajo
  ajeno; sin secretos/.env, índice, dependencias, GUI/preview o despliegue.
- Contratos: servicio, handlers, preload allowlist y API/wrappers tipados;
  AbortSignal sólo main. Respuestas raw de estado/config rechazan ante denegación.
- Riesgo/HITL: confirmar tarea/config/perfil/observación/entrada/ventana/calibración;
  abort/stop no requieren otro diálogo. Señal y revisión revocan publicaciones.
- Criterios: regresiones causales, límites/getters, cuatro capas, concurrencia y
  control mientras hay trabajo, cancelación de observación, claves hostiles,
  errores de persistencia, suite con cobertura y build con inventario estable.
- Incertidumbres: efectos ya enviados no se revierten; proveedores/drivers
  internos no tienen cancelación uniforme. La frontera IPC no certifica eventos
  globales, caches y memoria entre cuentas. Revisión independiente pendiente.
- Aislamiento: rama actual con unidades necesarias sin commit; respaldos de
  delta en TEMP y preservación del índice ajeno, sin worktree desde HEAD incompleto.
