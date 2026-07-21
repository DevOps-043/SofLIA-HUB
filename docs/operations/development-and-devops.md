# Desarrollo, CI y DevOps

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: package.json -->
<!-- evidence: .github/workflows/ci.yml -->
<!-- evidence: scripts/quality/run-gate.mjs -->

## Entorno local

Requisitos demostrados: Git, Node/npm, toolchain nativa para
`better-sqlite3`, dependencias Electron y PowerShell en Windows para varias
capacidades. Python embebido se prepara mediante script; no debe editarse
`python-runtime/` generado.

```powershell
npm.cmd ci
npm.cmd run rebuild:native:electron
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
| `test`, `test:fast`, `test:main`, `test:renderer`, `test:coverage` | suite con manejo de ABI o Vitest directo |
| `build:app` | typecheck + bundles; no instalador |
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
5. typecheck;
6. lint changed;
7. tests con ABI nativa.

Una salida verde no valida credenciales/proveedores reales ni UI manual.

## Release

Push a `main` o workflow manual dispara check de version. Si el release ya existe,
no reconstruye. Windows/macOS/Linux usan Node 20 y `npm ci`; secrets se escriben a
`.env` temporal. Se generan instaladores, se suben como artifacts y un job final
crea release en `DevOps-043/PulseHub-SofLIA-releases`.

Existe una diferencia intencional/no resuelta entre Node 24 de CI y Node 20 de
release. Toda dependencia que cambie soporte Node debe probar ambos entornos.

## Ownership y cambios externos

- CI de PR es read-only.
- Release requiere `RELEASES_TOKEN` con push al repo de distribucion; el workflow
  valida usuario/permisos antes de build.
- Migraciones Supabase, rotacion de secretos, release, push y PR son acciones
  externas y no se infieren de una solicitud de documentacion/codigo.
- No existe infraestructura IaC para Supabase/GitHub secrets en este repo.
