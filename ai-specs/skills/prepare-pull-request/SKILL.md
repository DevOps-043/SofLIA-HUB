---
name: prepare-pull-request
description: Prepara una entrega Git trazable con alcance, especificación, diff, evidencia, riesgos y plan de reversión. Úsala al finalizar una implementación y antes de publicar o solicitar revisión de un pull request.
---

# Preparar pull request

1. Confirmar rama, estado y base; excluir trabajo no relacionado y archivos locales.
2. Revisar el diff completo y relacionarlo con las tareas OpenSpec.
3. Ejecutar `$verify-change` y `$adversarial-review`.
4. Actualizar tareas, reporte de evidencia y documentación canónica.
5. Resumir problema, solución, decisiones, pruebas, riesgo residual y rollback.
6. Crear commits coherentes sin secretos ni afirmaciones de pruebas no ejecutadas.
7. Publicar o crear el pull request solo cuando el usuario lo haya autorizado.

No mezclar refactors oportunistas con el objetivo del cambio.
