# SofLIA Hub - Entrada para agentes

Este archivo es el router de contexto. La fuente canonica vive en `docs/` y
`ai-specs/`; no dupliques reglas extensas en archivos especificos de una
herramienta.

## Lectura obligatoria

1. `docs/standards/base.md`
2. La guia del area afectada:
   - Electron/IPC: `docs/standards/electron-ipc.md`
   - Base de datos: `docs/standards/database.md`
   - Pruebas: `docs/standards/testing.md`
   - Documentacion: `docs/standards/documentation.md`
3. El cambio activo en `openspec/changes/`, cuando exista.
4. El `SKILL.md` coincidente bajo `ai-specs/skills/`.

## Reglas no negociables

- Trabajar en cambios pequenos, trazables y verificables.
- No inventar datos, contratos, tablas, canales IPC ni resultados de pruebas.
- Mantener en espanol UI, prompts, comentarios, documentacion y logs.
- Conservar la separacion Electron main / preload / renderer.
- Todo canal IPC debe pasar por servicio, handler, preload allowlist y wrapper
  tipado del renderer.
- Toda operacion critica o destructiva requiere HITL explicito.
- No exponer skills de desarrollo, Git o shell a agentes runtime.
- No modificar secretos, `.env` ni configuraciones locales versionadas.
- Preservar cambios ajenos existentes en el worktree.
- Actualizar especificaciones y documentacion junto con el codigo.

## Comandos base

```powershell
npm run typecheck
npm run test
npm run harness:validate
npm run verify:pr
```

Usar `npm run verify:release` solo para candidatos a release porque incluye
empaquetado y verificaciones mas costosas.

## Estructura principal

- `electron/`: proceso main, preload, integraciones nativas y agentes runtime.
- `src/`: renderer React.
- `python/`: sidecars.
- `database/`: snapshots y migraciones separados por instancia.
- `resources/`: recursos runtime versionados.
- `docs/`: fuente de verdad tecnica y operativa.
- `ai-specs/`: agentes, skills, politicas y scripts del Arnes.
- `openspec/`: especificaciones vigentes y cambios activos.

El detalle historico anterior se conserva en
`docs/archive/project-guides/AGENTS-legacy-2026-07-21.md` y no es normativo.
