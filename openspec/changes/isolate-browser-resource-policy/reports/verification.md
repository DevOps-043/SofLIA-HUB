# Verificación de política de recursos del navegador

Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base Git: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente; revisión independiente pendiente.

## Resultado y contrato

El presupuesto anterior podía suspender audio/captura/carga/DevTools porque no
consultaba el trabajo que la inactividad ya protegía. BrowserResourcePolicy
comparte esa protección, presupuesto LRU, gracia/warm, throttling y timer.
El servicio mantiene vistas, perfiles, snapshot y las 144 firmas públicas
([comparación AST](api-comparison.json)). No cambia canales, renderer, sesión
persistida ni dependencias. Se preservan las nueve unidades anteriores.

El objetivo de ocho vistas admite exceso temporal protegido y retry de treinta
segundos. El timer consulta el estado actual e invalida callbacks antiguos.
Un error periódico no registra payload; una retirada completada se publica aun
si falla después el throttling de otra vista. Las llamadas síncronas propagan
errores. No se mide ni promete ahorro de CPU/RAM.

## Evidencia ejecutada

Logs locales: `%TEMP%/soflia-browser-resources-2026-10-22/`.

| Comando / caso | Resultado |
|---|---|
| Vitest servicio + checkpoint antes del cambio | 258 casos, dos archivos, salida 0; baseline.log. |
| Vitest del caso presupuesto/trabajo protegido antes del arreglo | Cuatro fallos reproducidos, salida 1; protection-red.log. |
| Vitest servicio + checkpoint tras integración inicial | 262 casos, salida 0; integration.log. |
| Vitest resource-policy + servicio + checkpoint finales | 279 casos en tres archivos, salida 0; directed.log. 21 casos nuevos frente a baseline. |
| npm run typecheck | Salida 0; typecheck.log. |
| npm run lint:changed | 142 archivos sin deuda nueva, salida 0; lint.log. |
| npm run docs:inventory:sync | Inventario derivado: 630 archivos, 425 main y 203 renderer más tooling; 494 canales conservados. |
| openspec validate isolate-browser-resource-policy --strict | Salida 0. |
| npm run browser:smoke:native -- --electron RUTA_ABSOLUTA --lifecycle-only | Ocho comprobaciones, salida 0; native-final.log y [reporte](native-lifecycle.json). |
| npm run app:smoke:build | Seis artefactos, 3309 fuentes, salida 0; build.log, [resumen](build-summary.json), [tamaños y hashes](build-artifacts.json). |
| git diff --check con cr-at-eol | Salida 0; diff-check-final.log. |
| npm run verify:pr | Salida 0: 4870 casos aprobados y cinco omitidos; 460 archivos aprobados y dos omitidos, 225,46 s de suite. Tipos, lint, arnés, documentación y tooling aprobados; verify-pr.log. |

## Alcance nativo y límites

Electron 44.5.1 real, Chromium 152.0.7977.130 y Node 24.21.0; proceso oculto,
perfil temporal, páginas about:blank y actividad protegida simulada. Se comprueba
throttling real, cierre de vistas, snapshot/identidad y rematerialización, además
de cinco regresiones de cierre/checkpoint. Los dos avisos sobre detener Python
provienen de servicios no provistos por el doble de lifecycle; no se arrancó
Python. No prueba reproducción/captura reales, formularios arbitrarios,
instalador ni el bootstrap completo del producto.

El build copia fuentes a un directorio temporal y excluye .env; no empaqueta ni
arranca la aplicación y no usa cuentas reales. Mantiene advertencias de tamaño
de chunks; este cambio no pretende resolverlas. No se midió rendimiento bajo
carga ni consumo de memoria con múltiples trabajos protegidos.

## Revisión y reversión

La [autorrevisión adversarial](adversarial-review.md) cubre protección, LRU,
retry, timers retenidos, cambio de perfil, errores, estado parcial y contratos.
Revisión independiente pendiente antes de archivar. El coordinador conserva
otras responsabilidades; no se afirma que la deuda arquitectónica esté saldada
ni se recalcula el porcentaje global a partir de casos o líneas.

Reversión: retirar módulo y puertos/delegaciones de recursos como unidad,
conservando el checkpoint y los otros nueve cambios. No hay migraciones ni
efectos remotos que revertir. Se conservan artefactos temporales propios como
evidencia; no se tocaron perfiles reales, secretos, .env ni configuraciones
locales versionadas. Sin commit, publicación ni despliegue.
