# Contexto del cambio

- Objetivo: impedir planes cruzados entre cuentas, traversal de archivos y falsos resultados completos de organización Gmail.
- Actor: usuario autenticado del Hub con conexión Google propia; consumidores runtime existentes con sus guardas previas.
- Alcance: preview/apply/undo y sus tres canales; custodia cifrada por usuario/cuenta, esquema cerrado, exclusión de operaciones, checkpoints de efectos y confirmación nativa.
- No objetivos: los otros canales Gmail, estado IRIS/Lia, migraciones remotas o garantizar transacciones/exactly-once en Gmail.
- Restricciones: conservar API posicional y allowlist, mantener módulos main/preload/renderer, preservar cambios anteriores, no inspeccionar perfiles reales ni adjudicar planes heredados sin propietario.
- Contratos afectados: respuestas de planes añaden partial/uncertain/recoveryRequired/cancelled; resultados repetidos completos no repiten efectos. Planes heredados se conservan en su sitio y no se ejecutan automáticamente.
- Riesgo y HITL: alto por mutaciones masivas y acceso local; apply/undo exigen aprobación contextual, owner/conexión/revisión estables y un solo plan en ejecución por cuenta. Pruebas sólo con datos ficticios.
- Criterios: IDs cerrados; aislamiento A/B y cuenta Google distinta; cifrado sin fallback, lecturas acotadas y reemplazo atómico; checkpoint previo a cada efecto; conteos confirmados tras fallo; resultado incierto y bloqueo de replay cuando queda efecto pendiente; undo con precondición de etiquetas actuales; concurrencia y cancelación sin efectos posteriores.
- Incertidumbres: Gmail no ofrece transacción con el disco ni compare-and-swap de etiquetas. Se conserva intención pendiente ante incertidumbre y se requiere revisión manual, sin inventar rollback. La revisión independiente queda pendiente antes de archivar.
