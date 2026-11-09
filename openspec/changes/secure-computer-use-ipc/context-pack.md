# Contexto del cambio

- Objetivo: continuar reduciendo deuda con la frontera completa de Computer Use.
- Actor: Hub/Orbe con sesión nativa vigente; fuentes ajenas no reciben capacidad.
- Alcance: canales computer existentes, validación, aprobación de efectos en main,
  límites de concurrencia, progresos/respuestas y contrato renderer/preload.
- No objetivos: reescribir Desktop Agent o rutas internas de WhatsApp/HTTP, custodiar
  todas las claves ni cancelar efectos ya enviados a SO/SMTP/archivos.
- Restricciones: conservar integración, funcionalidades y cambios ajenos; no tocar
  índice, secretos, configuración o dependencias. Sin GUI ni acciones reales.
- Contratos: tuplas IPC y objetos de opciones cerrados, servicio existente y API
  tipada; capability declarativa para evitar doble aprobación local en renderer.
- Riesgo/HITL: operaciones con efectos requieren confirmación nativa del snapshot;
  una respuesta renderer no concede autoridad. Sesión/navegación revoca resultados.
- Criterios: negativos causales previos, cuatro capas, payloads/bytes/getters,
  concurrencia física, revisión propia, suite global con cobertura y build aislado.
- Incertidumbres: acciones internas admitidas carecen de cancelación uniforme;
  documentar efectos físicos pendientes, no afirmar rollback. Revisión independiente
  pendiente. Rama actual contiene unidades necesarias sin commit; respaldar delta
  en TEMP y conservar el worktree en vez de bifurcar desde HEAD incompleto.
