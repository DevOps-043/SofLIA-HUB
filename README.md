# SofLIA Hub

Aplicación de escritorio Electron para operaciones asistidas por IA: WhatsApp,
Google Workspace, reuniones, monitoreo, memoria, automatización de escritorio y
gestión operativa para equipos hispanohablantes.

## Inicio rápido

Requisitos: Node.js 20.19 o superior, npm y las variables de entorno del proyecto.

```powershell
npm install
npm run dev
```

La aplicación separa el proceso Electron main del renderer React. No expongas APIs
nativas directamente: sigue el contrato de cuatro capas documentado para IPC.

## Verificación

```powershell
npm run typecheck
npm run test
npm run verify:pr
```

`npm run verify:release` agrega la compilación y el empaquetado; úsalo solo para un
candidato a distribución. Las pruebas reconstruyen temporalmente `better-sqlite3`
para Node y restauran después su ABI de Electron.

## Navegación

- [Documentación](docs/README.md)
- [Arquitectura](docs/architecture/system-overview.md)
- [Normas del proyecto](docs/standards/base.md)
- [Empezar a usar el Arnes](docs/operations/harness-quickstart.md)
- [Estandar maestro de ingenieria](docs/standards/engineering-practices.md)
- [Catalogo de producto y requisitos](docs/product/product-definition.md)
- [Matriz de trazabilidad](docs/product/traceability-matrix.md)
- [Arnés de agentes](ai-specs/README.md)
- [Antigravity: reglas y workflows](.agents/rules/soflia-harness.md)
- [Cambios OpenSpec](openspec/changes/)
- [Base de datos](database/README.md)

Comienza cualquier trabajo asistido leyendo [AGENTS.md](AGENTS.md). La guía histórica
anterior se conserva únicamente en `docs/archive/project-guides/`.
