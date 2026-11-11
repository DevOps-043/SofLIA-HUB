# Contexto del cambio

- Objetivo: reducir brechas transversales de QA y entrega, agrupando verificación para acelerar avance global solicitado por el usuario.
- Actor: desarrollo/CI que valida el mismo repositorio antes de entregar; sin cambio de permisos runtime.
- Alcance: cobertura V8 real de toda producción TS/TSX src/electron, reporte/umbrales efectivos en gate sin duplicar la suite; fijación SHA de Actions y política automatizada que rechaza referencias mutables; evidencia/matriz de deuda actualizada tras verificar.
- No objetivos: reemplazar any masivamente por tipos ficticios, ampliar supresiones, declarar cobertura con número de tests, cambiar firma/notarización sin certificados, SQL/secretos/despliegue o UI. El endurecimiento de grounding inspeccionado conserva su pendiente para otro lote.
- Restricciones: mismo worktree acumulativo y rama codex/reduce-technical-debt; no mover cambios anteriores ni otros worktrees. Sin stage/commit/push, .env, GUI bloqueada, instalación, firma o publicación. Dependencias V8/yaml ya están instaladas; no agregar paquetes.
- Contratos afectados: vitest.config.ts, test:coverage y verify:pr; workflows CI/release y política de Actions. Mantener los trece controles existentes; la ejecución de suite con cobertura reemplaza a la suite sin cobertura, no la omite.
- Riesgo/HITL: instrumentación puede encarecer CI; medir duración y conservar límites. Sólo se compila/prueba y resuelve metadata pública de Actions oficiales; sin ejecutar Actions remotas o código del proveedor.
- Criterios: reporte incluye archivos no importados; excluir sólo tests y declaraciones. Medir baseline antes de fijar umbrales globales y no bajar controles previos. Gate falla con cobertura ausente/insuficiente. Todas las acciones remotas usan SHA completo; el validador rechaza tags/ramas, referencias dinámicas y Docker sin digest. Enlaces/tipos/tooling/gate/build aprobados y hashes estables.
- Incertidumbres: cobertura exacta y coste pendientes de la medición ya iniciada. La elección de pisos sale de evidencia, no de un porcentaje inventado. CI remoto, firma y cobertura semántica de E2E siguen sin acreditarse.
