# Auto-Updater System — Resumen para Claude Code

## Instrucciones para Claude Code

Este directorio contiene la documentacion completa del sistema de auto-actualizaciones de una app Electron. Tu tarea es implementarlo en este proyecto.

**Lee `IMPLEMENTACION.md` completo** — contiene todo el codigo fuente, la arquitectura, el flujo paso a paso, y el checklist de integracion.

## Que hace este sistema

Sistema OTA (Over-The-Air) de auto-actualizaciones para Electron que:

1. **Verifica** nuevas versiones cada 4 horas contra GitHub Releases
2. **Descarga** automaticamente la actualizacion en background
3. **Notifica** al usuario con un toast flotante y barra de progreso
4. **Instala** silenciosamente al cerrar la app o cuando el usuario hace click en "Reiniciar"
5. **CI/CD** con GitHub Actions: al hacer push a main, buildea Windows + Mac y publica el release automaticamente

## Componentes (6 archivos a crear)

| Archivo | Que hace |
|---------|----------|
| `electron/updater-service.ts` | Servicio main process — electron-updater wrapper con EventEmitter, polling, estados |
| `electron/updater-handlers.ts` | IPC handlers — conecta servicio con renderer, forwarding de eventos |
| `src/services/updater-service.ts` | Renderer wrapper — API tipada sobre `window.updater` |
| `src/components/UpdateNotification.tsx` | Toast flotante bottom-right con progreso y acciones |
| `src/components/UpdatePanel.tsx` | Panel completo para settings con version actual, check manual, release notes |
| `electron-builder.json5` | Config de build con publish a GitHub Releases |

## Tambien requiere modificaciones en:

- `electron/preload.ts` — Agregar 8 canales al allowlist + exponer `window.updater`
- `electron/main.ts` — Instanciar UpdaterService, registrar handlers, llamar init()
- `App.tsx` — Montar `<UpdateNotification />` en el componente raiz

## Dependencias

```bash
npm install electron-updater
npm install -D electron-builder
```

## Prerequisitos

1. Crear repo en GitHub para releases (separado del codigo)
2. GitHub Token con scope `repo` como secret `RELEASES_TOKEN`
3. Crear `.github/workflows/release.yml` (incluido en IMPLEMENTACION.md)

## Stack asumido

- Electron + React + TypeScript + Vite
- Tailwind CSS (los componentes UI usan clases de Tailwind)
- IPC pattern: preload contextBridge con channel allowlist

Si el proyecto usa un stack diferente, adapta los componentes UI y el patron IPC.
