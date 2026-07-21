---
name: adversarial-review
description: Revisa un cambio intentando encontrar regresiones, permisos excesivos, estados parciales, datos inventados y rutas sin verificar. Úsala tras las pruebas normales y antes de cerrar una especificación o preparar un pull request de riesgo medio o alto.
---

# Hacer revisión adversarial

1. Leer propuesta, diseño, tareas, diff y evidencia sin asumir que la implementación es correcta.
2. Buscar contratos incompletos, rutas de error, concurrencia, reintentos e idempotencia.
3. Probar entradas vacías, grandes, malformadas y fuera de autorización.
4. Revisar secretos, logs, RLS, IPC allowlist, grupos de WhatsApp y límites HITL.
5. Detectar archivos huérfanos, duplicados, generados o documentación divergente.
6. Clasificar hallazgos por impacto y señalar evidencia exacta.
7. Corregir dentro del alcance autorizado o devolver la tarea a implementación.
8. Registrar qué hipótesis se intentaron refutar y el riesgo residual.

No convertir preferencias estilísticas sin impacto en hallazgos bloqueantes.
