# Baseline del Arnes - 2026-07-21

## Inventario inicial

- 2,515 archivos versionados.
- 1,534 archivos bajo `electron/`.
- 787 archivos bajo `src/`.
- 269 canales IPC detectados en los grupos del preload.
- 10 archivos `.pyc` versionados.
- Configuraciones JavaScript generadas sombreaban `vite.config.ts`.
- AutoDev fue eliminado del codigo en marzo de 2026, pero quedaron referencias
  documentales y un script npm invalido.

## Calidad inicial

- TypeScript: PASS.
- ESLint: 2,190 incidencias (2,163 errores y 27 warnings).
- Vitest: 915/942 pruebas aprobadas; 27 fallos.
- Fallos de memoria: ABI incompatible de `better-sqlite3`.
- Fallos de Auth: mock/import invalido de `AuthLogo`.
- Desktop Agent: un timeout y un worker no controlado.

Este archivo es evidencia historica. Los gates actuales deben consultarse en CI
y no deducirse de estas cifras.

La evidencia posterior a la implementacion vive en
`openspec/changes/implement-soflia-harness/reports/evidence.md`.
