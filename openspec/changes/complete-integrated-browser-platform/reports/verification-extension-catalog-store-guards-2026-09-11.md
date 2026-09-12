# Verificación: catálogo y conservación de almacenes

Estado: corte local, 2026-09-11. Cambio: complete-integrated-browser-platform.
Worktree .worktrees/upgrade-integrated-browser, rama codex/upgrade-integrated-browser,
base f52c8d6. Cambios anteriores preservados; sin commit, despliegue ni instalación
en perfiles personales. Se cierra **5.7**: **62/64 completas**, 8.7 y 9.5 abiertas.

## Implementación

- Catálogo local: ejemplo Reading Time de GoogleChrome, Apache-2.0, revisión
  inmutable `b55612ae647f6b9ef0401db91127489a4a80c070`, siete archivos fijados por
  SHA-256. Editor/fuente/pines se distribuyen con la app, no desde el manifiesto
  proporcionado por el usuario. Falta/sobra/cambio de un archivo rechaza revisión.
- UI muestra fuente oficial; el usuario descarga la carpeta exacta por su cuenta
  y abre selección nativa. No hay descargas ni actualizaciones automáticas.
  No es Chrome Web Store, un catálogo general ni verificación PGP en runtime.
- Actualización/reinstalación con token de cinco minutos: requiere deshabilitar,
  páginas en blanco y confirmación. Prepara otra copia, conserva sitios revocados,
  valida y carga antes del reemplazo del registro. Fallos de carga/registro o
  cambios concurrentes conservan la anterior; éxito retira sólo la copia sustituida.
  Una interrupción posterior al commit puede dejar una carpeta inactiva.
- Contrato de cuatro capas `extensions-catalog`: DTO cerrado, sin rutas o
  aprobaciones aportadas por renderer. Guardas de frame principal, titular del
  perfil, sesión, ventana, control humano y política empresarial. También invalida
  un cambio A→B→A aunque la revisión ya haya vuelto desde el handler.
- Historial, bitácora y memoria semántica: creación SQLite v0→v1 transaccional.
  DDL, validación y versión se confirman juntos; error revierte. No se reinterpretan
  bases ajenas sin versión, versiones futuras ni v1 incompletas como almacenes vacíos.
- Permisos por sitio: un archivo corrupto/futuro/inaccesible conserva sus bytes;
  navega con defaults, informa degradación y bloquea escrituras/restablecimiento.
  Antes de escribir relee disco y retira caché concedida ante fallo. La política
  del agente usa temporal exclusivo y lo limpia ante publicación fallida.

Código: [catálogo](../../../../electron/integrated-browser/extension-catalog.ts),
[gestor](../../../../electron/integrated-browser/extension-manager.ts),
[panel](../../../../src/components/browser/BrowserExtensionCatalog.tsx),
[migración SQLite](../../../../electron/integrated-browser/sqlite-schema.ts),
[permisos](../../../../electron/integrated-browser/site-permissions.ts).

## Evidencia final

- `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`:
  **1.289 pruebas / 103 archivos**, 42,20 s, salida 0. Corrige un uso inicial
  de Array.at no disponible en el target TS; no se cuenta esa corrida como typecheck aprobado.
- `npm run typecheck`: main/renderer, salida 0 después de la corrección y guarda de titular.
- `npm run lint:changed`: 285 archivos, sin deuda nueva, salida 0.
- `npx openspec validate complete-integrated-browser-platform --strict`: válido.
- `git diff --check`: salida 0; avisos normales de LF/CRLF.
- `npm run verify:pr`: adaptadores (27), harness (25 rutas / 9 skills), cadena de
  suministro (11 versiones vetadas / 18 hooks), docs sistema (28 documentos /
  150 IDs / 426 canales / 469 archivos de prueba) y enlaces aprobados.
  Se detiene en `skills:seed:check`: discrepancia preexistente entre
  database/lia/migrations/system-skills-catalog.sql y src/shared/skills/registry.ts.
  Ambos archivos sin diff contra HEAD; no se regeneró SQL ajeno. Typecheck y lint
  se ejecutaron por separado porque el gate no alcanza esas etapas.

### Electron real

`npm run browser:smoke:native -- --electron RUTA_ABSOLUTA_ELECTRON_LOCAL`:
**80 comprobaciones**, nueve fases, Electron 43.4.0, salida 0.
Artefactos aislados: `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-DJfCbb/`.
Incluye historial FTS, bitácora DPAPI, bóveda, sesiones, descargas, lifecycle,
formularios, zoom, protección, passkeys virtuales y extensiones de fixture.

Mismo comando con `--catalog-only`: **5 comprobaciones**, salida 0.
Artefactos: `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-ED9Dsa/`.
Descarga opt-in de siete archivos públicos a temporal, revisión SHA-256 y carga
del paquete oficial en Electron. Documento Chrome Developers servido localmente:
inserta tiempo de lectura, no inyecta en host ajeno, reinstala manteniendo lista
vacía de sitios y rechaza una alteración de un byte sin cambiar lo instalado.
Fetch sin redirecciones, quince segundos y un MiB máximo por archivo incluso
sin Content-Length. No interviene la cuenta o el perfil personal del usuario.

## Revisión adversarial principal

Hipótesis probadas: inventario extra/incompleto, paquete alterado, raíz de confianza
aportada por carpeta, perfiles privados/ajenos, sesión A→B→A, cambio de control,
subframes, DTO extra, aprobación/ruta por renderer, fallo de carga/publicación,
modificación concurrente y permisos revocados. Casos de UI: cancelación, desmontaje,
error sin falso éxito y actualización deshabilitada mientras la extensión está activa.

La revisión detectó y corrigió acceso potencial al perfil anterior durante la
propagación de una sesión nueva: ahora compara el hash del titular autenticado
con el perfil activo, además de fijar revisiones. Las pruebas de SQLite simulan
fallos creando/validando tablas, verifican rollback, reintento y reapertura, y
comparan bytes de archivos rechazados en los tres consumidores reales.

No se afirma defensa contra un proceso con permisos para alterar código y
registro, vigilancia continua de extensiones ni rollback multiproceso integral.
Las huellas oficiales confían en la distribución de la app y la fuente HTTPS
verificada durante desarrollo; no garantizan ausencia de defectos en el editor.

## Pendientes reales

- **8.7:** respaldo y recuperación integral de privacidad, permisos/políticas,
  atajos, bases SQLite y estados protegidos de sync. Hay que preservar cifrado,
  revocaciones y borrados, sin reactivar concesiones o identidades por restaurar
  copias antiguas. La creación transaccional no satisface ese alcance por sí sola.
- **9.5:** recorrido completo del producto/instalador Windows e interacción
  humana con Windows Hello/passkeys. Sync requiere despliegue autorizado de Lia
  y Auth/RLS/revocación en dos equipos reales. Ninguna fixture acredita ese rollout.

Fuente oficial: [revisión fijada de Reading Time](https://github.com/GoogleChrome/chrome-extensions-samples/tree/b55612ae647f6b9ef0401db91127489a4a80c070/functional-samples/tutorial.reading-time).
Se contrastó el commit y su estado verified/valid en GitHub, además de los bytes
de cada archivo; no se trasladó una afirmación de firma runtime al producto.
