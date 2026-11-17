# Verificación de compilación y estabilidad

Fecha: 2026-11-17. Host Windows local. Rama `codex/optimize-build-runtime`.

## Diagnóstico confirmado

- `pretypecheck` ejecutaba `npm ci` para Zoom en cada invocación, incluso sin cambios.
- La comprobación TypeScript inicial: 6315 archivos, 3951882 líneas de declaraciones, 3201973 K de memoria y 169,63 s. No incluye la reinstalación Zoom ni Vite/empaquetado.
- La importación raíz de Google incluye todo el catálogo de APIs. La fachada selectiva limita las declaraciones procesadas a 541835 líneas (aproximadamente 86% menos). La comprobación final sin caché incremental pasó: 5395 archivos, 2308521 K de memoria y 101,40 s. Son aproximadamente 28% menos memoria y 40% menos tiempo que la línea base; la carga concurrente y caché del SO impiden tratar esas cifras como un benchmark controlado entre equipos.
- `setInterval` del respaldo recibía días convertidos directamente a ms: intervalos superiores a 2147483647 ms exceden el rango Node y se reducen a 1 ms. El impacto en los cierres reportados es una hipótesis condicionada a esa configuración, no un crash reproducido del usuario.
- Ajustes y productividad estaban importados estáticamente. Build posterior produce chunks separados: 302,85 kB y 36,84 kB JS minificados respectivamente; esto no equivale a reducir esa misma cantidad de RAM.

## Medición reproducible de Google

Comando: `node scripts/performance/benchmark-google-imports.mjs`. Tres procesos por variante, orden alternado; sin red ni cuentas. Medianas:

| Variante | Carga | RSS del proceso | Módulos |
|---|---:|---:|---:|
| Catálogo completo | 5559,33 ms | 161,60 MiB | 1098 |
| Cinco servicios | 620,62 ms | 62,92 MiB | 140 |

Reducción observada: aproximadamente 89% del tiempo y 61% del RSS en este microbenchmark. Es carga Node aislada, no tiempo total de arranque Electron; caché del SO y otros procesos afectan resultados. No extrapolar a todos los equipos ni al empaquetado.

## Validaciones

- Pruebas focalizadas Calendar/Gmail/Drive/Chat, respaldos y AppWorkspace: 33 archivos, 434 pruebas aprobadas antes de añadir un caso adicional de concurrencia.
- `node --test scripts/quality/zoom-prepare.test.mjs`: aprobado, incluyendo lock divergente, versión errónea y paquete ausente.
- `npm run build:app`: aprobado con typecheck y bundles renderer/main/preload/presentación/audiovisual/Zoom. Persisten avisos de chunks grandes e imports dinámicos ineficaces ajenos a los puntos corregidos.
- Repetición incremental de TypeScript: aprobada, 28,07 s totales, 0,33 s de comprobación y 1002145 K de memoria. Aún parsea dependencias; no equivale a eliminar todo el coste de compilación. El proyecto node también pasó.
- `npm run lint:changed`: aprobado en repetición final, 35 archivos sin deuda nueva.
- `npm run docs:inventory:sync`: aprobado; inventario regenerado al añadir pruebas.
- `npm run docs:check`: aprobado en repetición final, 1096 archivos Markdown.
- `npx openspec validate optimize-build-and-backup-stability --strict --no-interactive`: aprobado.
- `npm run verify:pr`: pasó adaptadores, arnés, suministro, integridad CI, runtime estable, documentación, semilla, OpenSpec y 66 pruebas del tooling; se detuvo por ausencia de Python 3.12 en PATH, antes de tipos/lint/cobertura.
- Se preparó Python 3.12.11 de QA mediante `scripts/quality/prepare-test-python.mjs` en directorio temporal con hash aprobado, sin instalarlo en el sistema; `SOFLIA_TEST_PYTHON` sólo por proceso. `npm run python-tools:test`: 33 pruebas aprobadas. Tipos/lint se ejecutaron por separado. No se presenta el gate interrumpido como verde.
- Suite global con V8: 642 archivos aprobados y 2 omitidos; 7574 pruebas aprobadas y 5 omitidas. Duración 526,79 s. Cobertura: sentencias 61,33%, ramas 54,76%, funciones 57,84%, líneas 63,15%; no se rebajaron pisos ni añadieron exclusiones.
- `npm run test:coverage` terminó con código cero: inventario de 2738 fuentes productivas verificado por el guard de cobertura. Build repetido tras el ajuste del scheduler: aprobado. No se repitió la compuerta completa una vez preparado Python; se conserva la excepción y los resultados de cada etapa.

## Revisión adversarial

Se intentó refutar: reinstalación innecesaria por orden de claves (corregido), reutilización con paquete ausente (rechazada), desbordamiento mensual (regresión cubierta), solapamiento lento (cubierto), reactivación tras stop (cubierta), arranques concurrentes (corregidos sin ceder entre cancelar/armar), error sin listener (contenido por el scheduler), pérdida de la prueba visual por Suspense (se espera carga asíncrona), preservación de OAuth y sesión (pruebas SDK y ciclo de vida aprobadas). Los ignores del watcher se anclaron al checkout actual para no desactivar HMR cuando el propio checkout vive bajo `.worktrees` o `tmp`; tras ese ajuste final pasó TypeScript node y lint nuevamente.

Revisión local, sin revisión independiente ni archivado. No se enviaron mensajes ni se ejecutaron operaciones Google o respaldos reales. No se cambiaron secretos ni permisos.

## Límites y reversión

Sin dumps ni reproducción de los cierres del usuario, no se afirma que desaparezcan todos. La compilación fría aún consume memoria considerable; el instalador incluye Python, SDK multimedia y compresión que no se midieron como release. No se generó ni publicó instalador.

Revertir el diff devuelve el comportamiento anterior. Las cachés de tipos están ignoradas y son descartables. Las subrutas Google requieren prueba al actualizar su versión; `zoom:install` permite reparar contenido alterado cuya versión coincida, ya que la preparación rápida no verifica todos los archivos por hash.

Continuación del mismo día: la [optimización de recursos limitados](../../optimize-low-memory-runtime/reports/verification.md) ejecutó posteriormente `verify:pr` completo con Python de QA configurado y resultado aprobado sobre ambos cambios, con 7586 pruebas globales aprobadas.
