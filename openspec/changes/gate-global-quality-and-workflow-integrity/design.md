## Context

Ver [propuesta](proposal.md). V8 4.1.12 y yaml ya están en el lock. El baseline corre con include explícito de producción y reportes JSON en TEMP. Había 18 referencias mutables en CI/release; los workflows Python ya usaban SHA.

## Goals / Non-Goals

Medir y proteger toda producción sin cambiar runtime ni duplicar la suite. No prometer que cobertura alta demuestra correctitud, firma, CI remoto ni E2E reales.

## Decisions

- Usar V8 instalado, include explícito src/electron y exclusión sólo de tests/declaraciones. Reportar JSON completo/summary y texto. Versionar pisos de las cuatro métricas medidos antes de integrar y un verificador que rechace reportes ausentes/NaN/totales imposibles; no añadir exclusiones para pasar.
- Baseline productivo medido: 56.92% líneas, 55.61% sentencias, 51.70% funciones y 49.60% ramas en 2563 fuentes. Pisos: parte entera de cada valor (56/55/51/49). El remapeo inicial añadió tres mocks fuera de producción; excludeAfterRemap y test/** los retiran de la medición final, sin excluir producción. El validador comprueba inventario exacto y sumas por archivo para evitar cobertura parcial presentada como global.
- Ejecutar test:coverage en lugar de test al final de verify:pr; conservar el resto de controles. Subir reporte como artefacto sólo después del gate, con Action fijada, permisos actuales y sin secretos.
- Política YAML compartida para todas las entradas uses de jobs/pasos; permitir SHA completo, ruta local contenida o docker@sha256. Rechazar etiquetas, expresiones, rutas escapadas y YAML inválido. Probar casos negativos con fixtures; no modificar políticas de permisos existentes.
- Mantener majors v4 existentes y fijar commits resueltos por git ls-remote de actions/checkout, setup-node, upload-artifact y download-artifact oficiales; registrar metadata sin ejecutar su código.

## Risks / Trade-offs

- Instrumentación más costosa → medir tiempos y usar una sola suite final, sin omitir fuentes o tests.
- Cobertura inicial posiblemente baja → mostrarla y fijar piso real que impida retroceso; no declarar alcanzado un objetivo de 80/90 sin pruebas.
- SHA fija no equivale a revisión completa de Action → conservar limitaciones de suministro/firma y revisión independiente.

## Migration Plan

Respaldos en TEMP, baseline sin cambios de producto; después integrar política, referencias, configuración y docs. Pruebas negativas, gate con cobertura y build sobre hashes estables. Rollback restaura sólo archivos de esta unidad. Sin instalación, publicación, secretos o datos nuevos; no archivar sin revisión independiente.
