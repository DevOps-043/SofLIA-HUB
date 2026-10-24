# Contexto del cambio

- Objetivo: reducir responsabilidades y estado disperso del coordinador del navegador sin alterar sus contratos.
- Usuario o actor: usuarios que cierran, reabren o cambian de cuenta en el navegador integrado; desarrolladores que mantienen su ciclo de vida.
- Alcance: guardado automático, checkpoint de cierre, cancelación del cierre y seguimiento de la última escritura de sesión. Integración con el servicio y pruebas de contrato.
- No objetivos: rediseñar vistas, navegación, restauración, permisos, limpieza de perfiles, esquema persistido o IPC; resolver toda la deuda arquitectónica en una sola extracción.
- Restricciones: conservar API pública, demora de 250 ms, cola atómica del store, exclusión de pestañas sensibles y sesiones pendientes de recuperación; preservar los cambios anteriores del worktree.
- Contratos afectados: API interna entre el coordinador y la persistencia de sesión. Sin nuevos canales, dependencias, permisos ni formatos.
- Riesgo y HITL: riesgo medio de pérdida de sesión o escritura cruzada al cerrar/cambiar de perfil. Pruebas con datos ficticios y perfiles temporales; ninguna acción externa o destructiva de negocio.
- Criterios verificables: un único dueño de temporizador/última escritura/estado de cierre; guardado agrupado; espera y propagación de fallos; reintento limitado al mismo perfil; invalidación tras cancelación; estabilización de cambios durante E/S; pruebas existentes de servicio y compuerta de PR aprobadas.
- Incertidumbres: pruebas unitarias no acreditan comportamiento nativo de ventanas. Ejecutar smoke focalizado con Electron instalado y perfil temporal, sin bootstrap ni cuentas reales.
