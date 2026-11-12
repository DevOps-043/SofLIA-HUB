# Consolidación directa en main

Fecha: 12 de noviembre de 2026. Estado: integración publicada y verificación completada por etapas.

## Alcance y base

Solicitud explícita: unificar todas las ramas en main y corregir los conflictos,
sin crear más ramas. Base inicial limpia: `4c4be8c4`, idéntica a `origin/main`.
`git fetch --all --prune` actualizó las referencias antes del inventario.
Todos los worktrees registrados estaban limpios y se conservaron sin cambios.

Nueve referencias remotas no eran ancestros de main:

| Referencia origin/codex/ | Commit inicial |
| --- | --- |
| consolidacion-cambios-20261026 | 82142404 |
| fix-browser-agent-panel | 306799b3 |
| fix-organization-menu-logo | 9f963ee8 |
| organization-settings | 20bd4a86 |
| refine-live-agenda | bad2bcad |
| refine-settings-updates | adcea44d |
| refresh-platform-icons | f74fb373 |
| soflia-ai-agent | bcd0c29f |
| soflia-avatar-2d | b9f2575f |

La rama de consolidación ya incluía el avatar 2D. Ocho merges en main incorporan
las nueve referencias y preservan sus commits. Todas las demás ramas locales y
remotas ya estaban integradas. No se borran referencias ni se reescribe historia.

## Resoluciones y revisión adversarial

- Conservar las correcciones de autenticación y custodia de claves de main:
  AppModals y UnifiedSettingsModal no recuperan GOOGLE_API_KEY ni un prop apiKey.
- Combinar las reacciones del avatar con getPublicAiErrorMessage en el fallo del
  chat: no se restaura el registro del objeto de error del proveedor.
- Conservar en los merges duplicados la identidad de organización más reciente,
  nombre visible, logo de marca con fallback heredado y controles administrativos.
- Conservar la agenda, el historial de publicaciones documentado, el catálogo
  completo de iconos, la accesibilidad de ajustes y el avatar del compositor.
- Mantener la cobertura global y las pruebas de seguridad de main. Recalcular
  el inventario con docs:inventory:sync, sin recuperar cifras de ramas antiguas.
- La migración de ajustes de organización y su rollback se incorporan como
  archivos existentes de la rama. Esta consolidación no ejecuta SQL remoto.
- El proyecto 3D se conserva en soflia-ai-agent como proyecto independiente;
  no se afirma haber reconstruido Blender, sus binarios ni su demo.

Comprobación Git tras los merges:
`git for-each-ref --no-merged HEAD --format='%(refname:short)' refs/heads refs/remotes/origin`
no devuelve referencias pendientes.
El inventario comprende 34 ramas locales y 90 remotas, excluyendo el alias
origin/HEAD. El commit adicional `321367f6`, incorporado durante la verificación,
registra únicamente la sincronización del inventario documental y se conserva.

## Verificación

- `npm run docs:inventory:sync`: aprobado; 840 archivos de prueba.
- `npm run typecheck`: aprobado.
- `npm --prefix soflia-ai-agent run typecheck`: aprobado para el proyecto 3D.
- Pruebas focalizadas de avatar, ajustes, organización, agenda, navegador y chat:
  20 archivos y 178 casos aprobados antes de las correcciones de lint.
- `HARNESS_BASE_REF=4c4be8c4 npm run lint:changed`: la primera ejecución detectó
  91 errores y un aviso incorporados por las ramas. Tras corregirlos, 180 archivos
  revisados sin deuda nueva. No se excluyen fuentes ni se desactivan reglas:
  se declaran los entornos Node/DOM reales del proyecto 3D y sus smokes.
- La corrección del modal estabiliza el callback de confirmación y retira la
  escucha de Enter cuando no hay carpeta. La regresión cubre un callback
  actualizado y el estado cerrado/sin carpeta. La suite completa verificará
  también estas correcciones.
- `git diff --check 4c4be8c4`: aprobado tras retirar líneas vacías finales de dos
  archivos del proyecto visual.
- Primera ejecución de `npm run verify:pr`: aprobó adaptadores, arnés, cadena de
  suministro, integridad CI, estabilidad de Electron, documentación, semilla,
  OpenSpec y los 65 casos de herramientas; se detuvo por ausencia de Python 3.12
  en el equipo. No fue un resultado aprobado de la compuerta completa.
- `node scripts/quality/prepare-test-python.mjs`: preparó Python 3.12.11 x64 en
  temporal y verificó SHA256
  `51bc462f3d6caf4aef3d77209d01cd5f6c8fe8213c1ae739e573e1c2c473cb2b`.
  Se selecciona sólo por SOFLIA_TEST_PYTHON del proceso; no modifica PATH, .env
  ni el runtime empaquetado.
- Segunda ejecución de `npm run verify:pr`, con Python temporal y la misma base:
  aprobó también los 33 casos Python y detectó tres conversiones incompletas de
  fixtures a FolderState en la limpieza de lint. Se corrigieron con una conversión
  explícita desde unknown en `5fed32f4`; no se cambia el contrato del producto.
- Tercera ejecución de `npm run verify:pr`, con Python temporal y la misma base
  explícita, sobre `5fed32f4`: aprobó todos los pasos hasta lint inclusive
  (180 archivos sin deuda nueva). La cobertura ejecutó 633 archivos y 7,499
  casos correctamente, con 2 archivos y 5 casos omitidos por la suite, pero
  terminó con ocho errores de arranque de workers y código 1. No se declara
  aprobada esa ejecución de verify:pr.
- La prueba whatsapp-workflow-meetings, que también registró un aviso de cierre
  de worker, pasó por separado sus cuatro casos y terminó con código 0.
- Se repite únicamente `npm run test:coverage` en el mismo código, sin relajar
  timeouts, cobertura, exclusiones ni reglas. Resultado: código 0, 641 archivos
  aprobados y 2 omitidos; 7,563 casos aprobados y 5 omitidos. Sin errores de
  workers en la repetición. Duración: 544.79 segundos.
- El verificador confirmó las 2,737 fuentes productivas: líneas 63.1%, sentencias
  61.28%, funciones 57.79% y ramas 54.7%. Los pisos y el inventario de cobertura
  permanecen intactos. Todos los pasos requeridos se comprobaron en el código
  integrado; la ejecución monolítica de verify:pr conserva su resultado fallido
  por arranque de workers y se distingue de la repetición exitosa de su etapa.

## Cierre de revisión y publicación

La revisión local buscó retrocesos de credenciales, errores sin sanitizar,
autorización de organización, pérdida de cambios, referencias pendientes y
debilitamiento del gate. Se conservaron las guardas y se corrigieron los fallos
encontrados; no se modificaron secretos ni archivos .env. Las pruebas automatizadas
no sustituyen una sesión multimedia, cuentas externas o un instalador real.

`git push origin main` publicó las correcciones hasta
`5fed32f4d014f33dbc3c3361c8b895c3ff36a43e`, sin force. HEAD y origin/main
coincidieron después del envío. No quedaron referencias locales ni remotas fuera
de main. Esta evidencia se entrega mediante un commit documental posterior,
sin cambios al código verificado ni nuevas ramas.

## Riesgos y recuperación

La historia permanece recuperable desde `4c4be8c4` y los padres de cada merge.
La reversión debe hacerse con commits revert de los merges, en orden inverso,
revisando las dependencias; no requiere reset ni borrado de ramas. No se ejecutan
acciones sobre cuentas, sesiones multimedia, bases remotas o instaladores.
