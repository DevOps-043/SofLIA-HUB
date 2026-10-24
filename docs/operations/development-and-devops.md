# Desarrollo, CI y DevOps

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: package.json -->
<!-- evidence: .github/workflows/ci.yml -->
<!-- evidence: scripts/quality/run-gate.mjs -->

## Entorno local

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
| `test`, `test:fast`, `test:main`, `test:renderer`, `test:coverage` | Vitest main/renderer; Electron simulado en main |
| `test:quality` | regresiones del tooling con Node, incluidas raíz ESLint y baseline |
| `build:app` | typecheck + bundles; no instalador |
| `calendar:smoke:native` | custodia DPAPI real en Windows, perfil temporal y credenciales ficticias |
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

La compuerta ejecuta en orden:

1. adapters check;
2. harness validate;
3. system docs y links;
4. OpenSpec strict;
5. pruebas del tooling;
6. typecheck;
7. lint changed, rechazando errores fatales de parser en source o HEAD;
8. pruebas Vitest.

Una salida verde no valida credenciales/proveedores reales ni UI manual.

El smoke Python comprueba ready/ping/comando desconocido/shutdown en los dos
sidecars y repite ping/rechazo con la conexión main compilada en TEMP. Un runtime
de QA explícito permite comprobar protocolo sin instalar ni modificar el Python
distribuible; el reporte distingue esa procedencia. No carga Vosk/Piper, abre
micrófonos ni acredita parseo de documentos/modelos, instalador o plataforma
completa. La suite normal prueba el transporte mediante hijos Node ficticios con
tuberías reales y no requiere Python instalado en CI.

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

- CI de PR es read-only.
- Release requiere `RELEASES_TOKEN` con push al repo de distribucion; el workflow
  valida usuario/permisos antes de build.
- Migraciones Supabase, rotacion de secretos, release, push y PR son acciones
  externas y no se infieren de una solicitud de documentacion/codigo.
- No existe infraestructura IaC para Supabase/GitHub secrets en este repo.
