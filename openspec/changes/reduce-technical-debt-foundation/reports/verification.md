# Verificación de la primera unidad de reducción de deuda

Estado: implementación verificada localmente; pendiente de revisión independiente.
Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.

## Alcance y estado

Se implementan los contratos de calendario, tooling, publicación y documentación
del cambio. No se afirma haber completado todo el programa ni un nuevo porcentaje
de deuda; los siguientes bloques están en el plan. No se aplicó SQL, no se
rotaron claves y no se ejecutaron proveedores, instaladores ni publicación.
Los dos informes históricos no versionados se conservaron.

## Verificación

Los logs de trabajo están en el directorio temporal
C:/Users/fysg5/AppData/Local/Temp/soflia-debt-refactor-2026-10-22.
No son fuente normativa ni un requisito para ejecutar el cambio.

- Línea base focalizada: 36 pruebas aprobadas (calendario existente y panel de presentaciones).
- Calendario integrado: la suite final incluye 25 casos nuevos de IPC,
  8 de mutaciones/OAuth/preload y 4 del wrapper/chat/panel.
- Revisión de origen/frame: 25 pruebas IPC aprobadas tras cerrar el caso de
  navegación a un documento externo.
- Tooling: 4 pruebas Node aprobadas; parser fatal actual/baseline, conteo por regla/severidad y ESLint real excluyendo worktrees.
- Lint incremental: 28 archivos TypeScript, sin incidencias nuevas. La comparación
  bajo la misma configuración registra 67 errores históricos frente a 34 actuales:
  33 eliminados; cero advertencias. No es el inventario global del repositorio.
- YAML CI/release: parseado localmente; builds dependen de verify, usan Node 24
  y Linux llama build:linux, que incluye los tres runtimes auxiliares.
- Primera compuerta: rechazó tipos al precisar OAuth nullable. Se corrigió la
  ruta sin credencial antes de consultar Google y se añadió regresión.
- Primera ejecución de la suite completa: 4474 aprobadas, 2 timeouts en los
  casos históricos de XLSX del visor y equipos, 5 omitidas. Se acotó el pool a
  min(4, núcleos disponibles) y se movió la importación fría de ExcelJS a la
  recolección en esas suites. Los timeouts y las aserciones se conservaron.
  Regresión focalizada posterior: 54 pruebas aprobadas.
- `npm run verify:pr`: **aprobado, salida 0**. Incluye adaptadores, harness,
  supply-chain, documentación, semilla de skills, OpenSpec, tooling, tipos, lint
  y la suite completa. Vitest: **436 archivos aprobados, 2 omitidos; 4476 pruebas
  aprobadas, 5 omitidas, 0 fallos** (195,29 s). Tooling Node: 4 aprobadas.
  OpenSpec: 71 cambios válidos. El inventario registra 494 canales sin agregar
  canales nuevos y 604 archivos relacionados con pruebas.

Evidencia resumida persistente: [verification.json](verification.json).
El audit de supply-chain comprueba versiones vetadas y ganchos, no sustituye
la auditoría GHSA/CVE. Persisten advertencias de Vite por la carga de configuración
y de Node por localStorage experimental; no se silenciaron. No se ejecutó
`verify:release`, smoke de instaladores ni pruebas con proveedores reales.

## Revisión adversarial

Autorrevisión adversarial; no se presenta como revisión independiente.
Hipótesis intentadas: frame/ventana ajenos, documento externo dentro de una
ventana propia, payload extra o excesivo, fechas inválidas/invertidas, subframe,
logout/login A-B-A, navegación durante permiso, conexión reemplazada, ventana
retirada, respuesta caducada, doble diálogo, error remoto con token/ruta,
credencial ausente, guardia revocada durante await de OAuth y evento interno
con conexión completa. Las pruebas rechazan efectos o proyectan sólo campos
públicos. No se usaron cuentas ni secretos reales.

La inspección encontró y corrigió dos rutas residuales: reenvío duplicado de
eventos work-start/work-end desde startup, y consulta Google con OAuth nulo.
También se conservó la separación de servicio/main/preload/wrapper; no se
expusieron primitives genéricas ni se crearon canales nuevos.

Riesgo residual: el almacén OAuth heredado sigue necesitando migración cifrada
y separación por usuario, y las claves compartidas del build requieren un
backend/credenciales alternativas antes de retirar el fallback. Este bloque
no corrige RLS/despliegues ni garantiza rollback de una petición ya enviada.
La aprobación de cada mutación incluye cuenta, ID/calendario y cambios exactos;
no certifica que un ID corresponda al objeto que el usuario tenía en mente.

## Rollback

Revertir esta unidad de código/tooling sin borrar perfiles o conexiones. No hay
migración de formato persistente. Un rollback local no revierte eventos de
calendario ya creados/editados/eliminados. El cambio no se archiva: falta la
revisión independiente exigida para archivar y los siguientes bloques no están
implementados.
