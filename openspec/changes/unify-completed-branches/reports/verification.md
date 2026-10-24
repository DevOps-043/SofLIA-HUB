# Integración local de ramas terminadas

Fecha: 2026-10-24. Estado: integración construida; verificación en curso.

## Alcance y decisiones

Base: `codex/project-panel` (`3b4f898`). Main local inicial: `61cbadf`;
main remoto observado: `d8c1de5`. Se actualizó el inventario remoto mediante fetch.

| Rama incorporada | Commit de origen | Tratamiento |
| --- | --- | --- |
| project-panel | `3b4f898` | Base; incluye estudio y transiciones |
| origin/codex/hub-consolidado-20261014 | `1668071` | Evidencia documental previa |
| fix-browser-shutdown | `06ae9d5` | Merge; documentación vigente del navegador conservada |
| fix-chat-menu-overflow | `8e980c4` | Historial incorporado; arreglo ya contenido en el panel |
| fix-computer-use-continuity | `975c86e` | Historial incorporado; arreglo ya contenido en el panel |
| zoom-video-sdk | `68117d2` | Runtime Video SDK y compatibilidad Meeting |
| remove-project-hub-integration | `a7d705c` | Historial reconciliado; retirada sustituida por panel posterior |

Los nombres abreviados corresponden a `codex/`. El inventario completo y la
comprobación de ancestry están en [branches.json](branches.json).

Se excluye `codex/reduce-technical-debt`, inicialmente en `e166d25`, y todo
trabajo sin commit del checkout principal. Ese commit compartido entra también
por `studio-transitions`; su inclusión no implica fusionar trabajo de deuda.
Los otros tres worktrees se observaron limpios y no se modificaron.

La retirada histórica de Project Hub y el panel posterior son incompatibles como
árbol final. Se contrastaron fechas, propuesta de espacios portables y el chat
de proyectos, cuyo último estado confirma gestión implementada y migraciones
aplicadas, con despliegue de la API pendiente. Se conserva la entrega más nueva
mediante un merge `ours` de la retirada; no se certifica despliegue ni se ejecuta SQL.

## Verificación

- `npm run docs:inventory:sync`: correcto; 675 archivos de prueba y 521 canales.
- Primera ejecución dirigida de navegador, Computer Use, protocolo Zoom y panel:
  6 archivos aprobados, 1 fallido; 299 pruebas aprobadas, 2 fallidas.
- Fallos: concesión de cámara/micrófono a una pestaña de fondo y cola de avisos
  de permisos. Ambos esperan callbacks con `vi.waitFor`. El servicio y su archivo
  de pruebas son idénticos a `3b4f898` (`git diff 3b4f898 HEAD --` sin diferencias).
  Repetición aislada con dependencias propias: ambas pruebas aprobadas (222 ms
  de ejecución). El primer fallo no persistió; no se alteraron los tests ni el servicio.
- Preparación: `npm ci --ignore-scripts --no-audit --no-fund` en el worktree y
  en `packages/zoom-runtime`; sin modificar dependencias del checkout principal.
- El primer typecheck detectó `@zoom/videosdk` ausente; se instaló el lockfile
  aislado antes de repetir mediante la compuerta completa.
- `npm exec -- tsc -p packages/zoom-runtime/tsconfig.json`: correcto.
- `npm exec -- vite build --config vite.zoom.config.mts`: correcto; advertencia
  de tamaño de los bundles de proveedores. No es una prueba de llamada real.
- `npm run harness:validate`: correcto, 25 rutas y 10 skills.
- Compuerta en curso: documentación y suministro correctos; OpenSpec estricto
  93/93; pruebas de scripts 4/4. El enlace al inventario falló temporalmente
  mientras se construía el JSON; pasó al completar el archivo en la compuerta.

## Revisión adversarial

- Se intentó detectar pérdida de ramas por contener sólo commits históricos:
  cobertura de ancestry para todas las referencias inventariadas.
- Se examinó la posible reactivación de la retirada antigua: el diff se descarta
  deliberadamente para preservar el panel posterior y sus controles IPC/HITL.
- Se comprobó que los merges de navegador, menú y Computer Use no sustituyen sus
  implementaciones más recientes: árbol final igual a la base del panel en esas rutas.
- Se recalcula el inventario; no se modifican baselines de lint ni se inventan
  resultados de llamadas Zoom, permisos de servidor o despliegues.
- Cobertura: 99 referencias inventariadas, 98 incluidas como objetivo y una
  referencia excluida que comparte un ancestro ya incluido por otras ramas.

## Recuperación y límites

Main se avanza localmente por fast-forward, conservando una rama de respaldo.
No se publican referencias, se borran ramas ni se alteran worktrees ajenos.
La carpeta principal continúa en la rama de deuda; para usar el árbol unificado
se debe abrir su worktree aislado. La activación real de Video SDK y de la API
de proyectos conserva los requisitos operativos de sus cambios originales.
