# Reevaluación de deuda técnica del 7 de noviembre de 2026

Estado: evaluación local del worktree de escritorio; migración integral abierta.

## Resultado y método

**Índice global estimado: 38,875% (38,9%, aproximadamente 39%).** El índice anterior
era 40,875%: reducción de 2 puntos. Desde el diagnóstico inicial de 50,375%, la
reducción acumulada es de 11,5 puntos. Es un índice experto de brechas ponderadas,
no una proporción de horas SQALE ni una certificación de producción.

Se reevaluaron los mismos 44 criterios en 11 áreas, conservando pesos y escalas
0/25/50/75/100. Cada área promedia cuatro criterios. Los niveles no cambian sólo
por aumentar pruebas o reducir líneas: requieren evidencia suficiente de cierre.
El detalle, fuentes y puntuación de cada criterio están en el
[reporte reproducible](technical-debt-reassessment-2026-11-07.json).

| Área | Peso | Brecha del área |
|---|---:|---:|
| Seguridad y privacidad | 20% | 37,5% |
| Arquitectura y modularidad | 12% | 43,75% |
| Calidad de código y tipado | 12% | 37,5% |
| Pruebas y calidad funcional | 15% | 31,25% |
| Datos e integridad | 10% | 50,0% |
| Dependencias y cadena de suministro | 8% | 25,0% |
| CI/CD, empaquetado y publicación | 8% | 37,5% |
| Observabilidad y operación | 5% | 50,0% |
| Rendimiento y escalabilidad | 4% | 50,0% |
| Documentación y gobierno | 3% | 31,25% |
| Accesibilidad y UX | 3% | 50,0% |

La confianza es media-baja: la evidencia es local y los criterios son ordinales.
No hay intervalo estadístico. Las franjas sin cierre demostrado se conservan.

## Evidencia y cambios

- Las claves de inferencia se excluyen de renderer/preload. Medios, especialistas,
  utilidades, reuniones y tareas JSON migradas usan OpenAI nativo.
- El lint productivo baja de 1589 a 1269 errores; no-explicit-any de 1416 a 1097.
  Los errores históricos restantes siguen visibles y no se amplían supresiones.
- La auditoría completa pasó de 33 a 31 paquetes afectados tras parches compatibles:
  cero high/critical, 28 moderate y tres low. Producción conserva 14 moderate y
  tres low. Los avisos de desarrollo ya no están en cero como en octubre.
- El coordinador del navegador conserva 5532 segmentos de línea; siguen tres
  fuentes productivas por encima de 1000. Las brechas de cohesión no se dan por cerradas.

Los recibos y límites de implementación están en
[la verificación de retirada](../../openspec/changes/retire-google-ai-provider/reports/verification.md)
y [la auditoría de dependencias](../../openspec/changes/patch-november-advisories/reports/dependency-audit.json).

## Retirada e integración pendientes

No se ha eliminado todo Gemini: el
[inventario operativo](../../openspec/changes/retire-google-ai-provider/reports/remaining-provider-files.json)
contiene 56 archivos con SDK o endpoint directo. Faltan rutas heredadas de chat,
grounding y medios, audio/auxiliares de WhatsApp, embeddings y memoria, control
visual y otras utilidades; después deben retirarse dependencias y configuración.
El número de archivos no representa porcentaje funcional de la migración.

La [simulación de integración](../../openspec/changes/retire-google-ai-provider/reports/integration-analysis.json)
detecta 72 rutas con conflicto frente a 0dc4d698 y 82 frente a 18cec138. Los dos
commits también tienen 36 rutas en conflicto entre sí. Se normalizó CRLF para
comparar texto. La simulación por ruta no resuelve renombrados ni comprueba lógica
combinada. No se aplicó un merge ni se alteró el índice del usuario.

No se recomienda integrar directamente ni declarar candidato a release: faltan
resolver conflictos y ejecutar pruebas sobre el resultado integrado, completar
la retirada del proveedor y revisión independiente. También siguen pendientes
RLS/ownership e integridad de borrados IRIS, E2E instalado y proveedores reales,
carga de 800 usuarios, observabilidad, accesibilidad y entrega firmada por plataforma.
No hay entorno macOS Intel disponible para acreditar su artefacto Python.


## Recibo de verificación local

Compuerta de PR y build aislado: código 0. Pasaron 7096 pruebas Vitest y se
omitieron cinco; también 64 contratos del tooling y 33 de Python. Se verificaron
2633 fuentes productivas: líneas 60,93%, sentencias 59,37%, funciones 55,86% y
ramas 52,70%. Lint incremental: 794 archivos sin nuevas incidencias.
Documentación y OpenSpec se comprobaron de nuevo tras actualizar estos reportes.

Huella productiva SHA-256:
`cab2e3cb755a04df62493bbc00087ec62eaf807ab1ff45f729daeff02701b2d3`.
El [recibo detallado](../../openspec/changes/retire-google-ai-provider/reports/latest-verification.json)
registra hashes y límites. El build conserva avisos de tamaño de fragmentos.
