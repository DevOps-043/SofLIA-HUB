# Desarrollo, CI y DevOps

Estado: vigente. Actualizado: 2026-10-30.

<!-- evidence: package.json -->
<!-- evidence: .github/workflows/ci.yml -->
<!-- evidence: scripts/quality/run-gate.mjs -->

## Entorno local

OpenAI se resuelve en main: su clave VITE_OPENAI_API_KEY mantiene el nombre
heredado para compatibilidad, pero la configuración Vite la excluye de
renderer/preload. El cliente Responses requiere el puente nativo; no existe
fallback HTTP en el renderer si falta/rechaza ese puente. No cambiar .env para
verificarlo: usar un build aislado con un centinela ficticio y comprobar las
salidas públicas y main. Las otras variables públicas conservan su migración
pendiente. [Contrato](../security/security-and-privacy.md#inferencia-openai-nativa).

Requisitos: Git, Node 24 con SQLite integrado, npm, dependencias Electron y
PowerShell en Windows para varias capacidades. La persistencia usa node:sqlite;
no se reconstruye better-sqlite3. Python embebido se prepara mediante script; no debe editarse
`python-runtime/` generado.

```powershell
npm.cmd ci
npm.cmd run dev
```

En hosts donde PowerShell bloquea `npm.ps1`, usar `npm.cmd`. `dev:clean` limpia
procesos/salidas de desarrollo; revisar su alcance antes de ejecutarlo con trabajo
no guardado.

## Scripts canonicos

| Script | Uso |
|---|---|
| `dev`, `dev:fresh` | Vite + Electron en desarrollo |
| `typecheck` | TS renderer y node sin emitir |
| `lint`, `lint:changed` | global o no-regresion de archivos cambiados |
| `test`, `test:fast`, `test:main`, `test:renderer`, `test:coverage` | Vitest main/renderer; Electron simulado en main; coverage incluye inventario productivo completo y pisos obligatorios |
| `ci:integrity` | rechaza Actions remotas mutables, Docker sin digest y rutas locales escapadas; revisa también actions compuestas locales |
| `test:quality` | regresiones del tooling con Node, por archivo en serie, incluidas raíz ESLint, selección Git y baseline |
| `python-tools:test` | contratos Python stdlib obligatorios en verify:pr; exige Python 3.12.x |
| `python-tools:test:formats` | runner con bibliotecas y versiones exactas de ambos locks, sin instalar nada |
| `runtime:stable` | versión estable/excepción vigente, rangos de seguridad y concordancia manifiesto/lock/paquete/binario Electron |
| `build:app` | typecheck + bundles; no instalador |
| `calendar:smoke:native` | custodia DPAPI real en Windows, perfil temporal y credenciales ficticias |
| `calendar:oauth:smoke:native` | fachada OAuth en Electron real, callback loopback, sandbox y cancelación; navegador sustituido, sin cuentas |
| `validation:smoke:native` | Zod/ZIP e inferencia ONNX CPU en Node/Electron reales, parser Sharp con modelos/imágenes propios de QA; sin descargas o control de escritorio |
| `document-export:smoke:native` | SDK/archivos Office y exportador PPTX real del Hub en Node/Electron; OOXML, imágenes y CF/UUID, sin Office instalado ni datos reales |
| `python:smoke:connection` | contratos Python v4/v1 y transporte main real, sin audio/modelos; usa runtime del checkout o `-- --python RUTA_ABSOLUTA_QA` |
| `build`, `build:win/mac/linux` | recursos Python + electron-builder |
| `adapters:sync/check` | wrappers Codex/Claude/Antigravity |
| `harness:validate` | estructura, skills y artefactos prohibidos |
| `docs:check`, `docs:system:check` | links y cobertura/trazabilidad |
| `openspec:validate` | todos los cambios/specs strict |
| `verify:pr`, `verify:release` | compuerta integral; release agrega build |

## Flujo de cambio

1. Verificar Git y usar rama `codex/*` o worktree recuperable.
2. Enriquecer solicitud y crear Context Pack/OpenSpec para cambio material.
3. Implementar tareas pequenas con tests/docs.
4. Ejecutar pruebas dirigidas durante desarrollo.
5. Ejecutar `verify:pr`; para release autorizado `verify:release`.
6. Revision adversarial, evidencia y commit; push/PR solo cuando se autorice.

## CI de pull request

`.github/workflows/ci.yml` corre en Ubuntu, Node 24, `npm ci` y
`npm run verify:pr`. Usa fetch depth 0 y `HARNESS_BASE_REF` para lint incremental.
Permisos GitHub: `contents: read`; no publica, despliega ni modifica repositorios.

CI y release fijan las Actions a SHA completo de sus repositorios oficiales.
`ci:integrity` recorre workflows y actions compuestas locales, también las
referenciadas fuera de .github/actions; rechaza tags, ramas, expresiones, enlaces
y YAML inválido. No ejecuta Actions remotas y no certifica todo su código ni
firma/notarización. La política corre antes de la suite en verify:pr.

El gate usa test:coverage en lugar de repetir test más coverage. La política
versionada exige cuatro métricas globales y la presencia de todas las fuentes
productivas en coverage-summary.json. CI/release conservan summary y LCOV siete
días como artefactos de QA, con referencias fijas y sin ampliar permisos.
coverage/ es generado e ignorado por Git. Los pisos iniciales vienen de la
[medición y límites](../../openspec/changes/gate-global-quality-and-workflow-integrity/reports/verification.md),
no de una promesa de cobertura 80/90% ni de E2E instalado.

verify:pr incluye contratos Python sin dependencias; Python 3.12.x pasa a ser
prerrequisito local. Seleccionar un intérprete instalado por proceso:
`$env:SOFLIA_TEST_PYTHON='C:/ruta/python.exe'`. Un override debe ser absoluto;
ausencia, versión distinta o timeout fallan, sin omisión silenciosa. No guardar
esta selección en .env. `node scripts/quality/prepare-test-python.mjs` prepara
en temporal el mismo standalone 3.12.11/SHA256 fijado por el producto y devuelve
un recibo; no instala bibliotecas ni modifica PATH o python-runtime. Se conserva
el temporal para revisar evidencia.

CI usa ese preparador y registra sólo SOFLIA_TEST_PYTHON en el entorno del job.
Se comprueban hash antes de extraer y versión/arquitectura antes de ejecutar
pruebas. Comparte descarga HTTPS acotada con setup, sin aceptar overrides de
fuente para QA. Se evita setup-python 3.12.11 en macOS/Windows porque su
[manifiesto oficial](https://github.com/actions/python-versions/blob/main/versions-manifest.json)
no ofrece ese patch en esas plataformas.

El workflow reutilizable python-readers.yml, llamado desde CI y release,
instala bootstrap/lector hashed y sólo wheels en un venv temporal por target:
Windows x64, macOS ARM64 y Ubuntu x64/ARM64. Comprueba SO/arquitectura/patch,
pip check y formatos; los builds de release esperan ese job además de verify.
No usa voz, audio, modelos, secretos o permisos de publicación. Está configurado;
su presencia en el repositorio no acredita ejecución remota. Intel conserva
su workflow de candidato pendiente, usando el mismo preparador de intérprete.

La compuerta ejecuta en orden:

1. adapters check;
2. harness validate;
3. auditoría de suministro;
4. estabilidad/política de avisos y coincidencia del binario Electron;
5. documentación de sistema;
6. enlaces;
7. semilla de skills;
8. OpenSpec strict;
9. pruebas del tooling;
10. contratos Python stdlib;
11. typecheck;
12. lint changed TS/JS, contra bases Git verificadas, rechazando errores de Git y parser;
13. pruebas Vitest.

Una salida verde no valida credenciales/proveedores reales ni UI manual.

El lint usa el ancestro común entre `HARNESS_BASE_REF` y HEAD para cambios del
PR y HEAD para cambios locales, exigiendo ambas bases cuando corresponda.
No omite una referencia inválida ni interpreta errores Git como ausencia de
cambios. Sin referencia explícita, un checkout limpio revisa el último commit;
una copia shallow sin padre comparable requiere recuperar historia o aportar
una base comprobable. No basta con borrar el override para validar historia
incompleta. Alcance de extensiones, índice, renombres y cantidades históricas:
[estándar de pruebas](../standards/testing.md#regla-de-baseline).

El smoke Python comprueba ready/ping/comando desconocido/shutdown en los dos
sidecars y repite ping/rechazo con la conexión main compilada en TEMP. Un runtime
de QA explícito permite comprobar protocolo sin instalar ni modificar el Python
distribuible; el reporte distingue esa procedencia. No carga Vosk/Piper, abre
micrófonos ni acredita parseo de documentos/modelos, instalador o plataforma
completa. La suite normal prueba el transporte mediante hijos Node ficticios con
tuberías reales; el gate requiere además Python para sus contratos stdlib.

## Release

Push a `main` o workflow manual dispara check de version. Si el release ya existe,
no reconstruye. Windows/macOS/Linux usan Node 24 y `npm ci`; secrets se escriben a
`.env` temporal. Se generan instaladores, se suben como artifacts y un job final
crea release en `DevOps-043/PulseHub-SofLIA-releases`.

El job verify del workflow de release ejecuta verify:pr sobre el mismo SHA antes
de los builds. Cada plataforma usa build:win, build:mac o build:linux (Windows
conserva build, equivalente al destino Windows en ese runner). Las tres cadenas
incluyen presentaciones, audiovisual y Zoom. Esta configuración local no demuestra
una ejecución remota ni firma/notarización de artefactos.

ESLint fija su raíz al directorio de configuración y excluye .worktrees/: esos
checkouts se verifican desde su propia raíz. No se relajan reglas ni se oculta
la deuda histórica del checkout principal.

## Actualizaciones de dependencias

Comparar `npm audit --json` y `npm audit --omit=dev --json` antes y después de
cambiar dependencias. Separar paquetes afectados de avisos únicos y de
explotabilidad real. `audit:supply-chain` comprueba versiones vetadas y ganchos;
no consulta todos los avisos del registro. No usar `audit fix --force` ni
downgrades automáticos como sustituto de revisar consumidores y compatibilidad.

ExcelJS 4.4.0 y PptxGenJS 4.0.1 quedan fijados con overrides únicamente bajo
esos padres/versiones para uuid 11.1.1 e image-size 2.0.4. La compatibilidad
se comprueba con archivos reales y contratos CJS/ESM: ExcelJS sólo utiliza v4
sin argumentos y los bundles actuales de PptxGenJS no importan image-size.
No extender el selector a otras versiones/consumidores sin revisar sus APIs.
Al actualizar el padre, reevaluar lock/llamadas y retirar el override cuando
su cierre oficial sea seguro; ejecutar test:quality y document-export:smoke:native.
Un menor contador npm no demuestra que el Hub invocara el path vulnerable ni
corrige copias embebidas dentro de bundles de terceros. Alcance y evidencia en
[el cambio documental](../../openspec/changes/secure-document-export-dependencies/reports/verification.md).

Los peers abiertos de `@jimp/plugin-scale@0.22.12` y
`@jimp/plugin-shadow@0.22.12` se restringen sólo bajo esos padres a resize/blur
0.22.12, la API del conjunto Jimp que consumen nut-js/shared 4.2.6. Esto retira
el subárbol moderno innecesario sin sustituir las APIs activas ni forzar Zod 4
sobre consumidores 3. No extender esos overrides globalmente o a otros padres.
Retirarlos cuando el padre cierre sus peers o el consumidor migre, con revisión
de APIs/lock y los mismos contratos. El aviso file-type heredado permanece:
requiere una migración o backport mantenido compatible, no una supresión.

`test:quality` ejecuta tres contratos de resolución e imágenes. Para comprobar
también el Node incluido en Electron: `node scripts/quality/smoke-image-dependencies.mjs`.
El runner crea un temporal propio, conserva evidencia y bloquea HTTP(S)/fetch;
Electron corre con `ELECTRON_RUN_AS_NODE=1`, sin ventanas, bootstrap o captura/control
del escritorio. Se verifican píxeles/conversiones y proveedores de archivos,
no búsqueda visual, permisos del SO o automatización real. Auditorías y límites
en [el reporte de imágenes](../../openspec/changes/constrain-legacy-image-peer-resolution/reports/verification.md).

Resolver el lock con `--package-lock-only --ignore-scripts`, revisar el diff y
los ganchos antes de instalar. Tras instalar, contrastar los package.json
físicos y, para nativos, la versión cargada: `npm ls` puede confiar en el lock
oculto aunque el contenido instalado siga siendo anterior. Ante discrepancia,
conservar ese lock oculto como evidencia, regenerar la instalación y verificar
de nuevo; no editar versiones de paquetes a mano.

Las actualizaciones de Vite se verifican con `npm run app:smoke:build`: el smoke
existente copia fuentes a un directorio temporal, excluye .env y configuraciones
locales y compila los bundles. No acredita empaquetado, arranque ni cuentas
reales. Los cambios de módulos nativos requieren pruebas en cada plataforma
de distribución. La evidencia puntual de actualizaciones vive en el cambio
OpenSpec, no se usa como garantía permanente de cero vulnerabilidades.

## Ownership y cambios externos

El lector Python tiene instalación reproducible separada de voz. Mantener
`python/tools_sidecar/requirements.lock` y `python/bootstrap.lock` con versiones
exactas/hashes y revisar avisos, licencias y wheels por target antes de cambiar
sus pins. Setup y smoke comparten fingerprint y validación; no editar una caché
para saltarse fallos. Ejecutar el runner Python con `--formats` en venv temporal
con ambos locks instalados. El gate Node no instala ni prueba estos parsers.
Disponibilidad por plataforma, candidato Intel pendiente y recuperación:
[frontera documental](../security/python-document-boundary.md).

- CI de PR es read-only.
- Release requiere `RELEASES_TOKEN` con push al repo de distribucion; el workflow
  valida usuario/permisos antes de build.
- Migraciones Supabase, rotacion de secretos, release, push y PR son acciones
  externas y no se infieren de una solicitud de documentacion/codigo.
- No existe infraestructura IaC para Supabase/GitHub secrets en este repo.
