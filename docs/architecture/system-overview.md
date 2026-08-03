# Arquitectura vigente

Pulse Hub es una aplicación Electron. `electron/main.ts` compone servicios nativos,
integraciones externas y ciclo de vida; `electron/preload.ts` expone una frontera
limitada al renderer React de `src/`.

```text
Renderer React
  -> wrapper tipado de src/services
  -> API expuesta por preload y allowlist
  -> ipcMain handler con validación
  -> servicio del proceso main
  -> Supabase, SQLite, Google APIs, WhatsApp o sistema operativo
```

## Persistencia

Las instancias Supabase se separan por dominio: SOFIA Learning para identidad, Lia
para operación del Hub e IRIS para proyectos/CRM/workflows. SQLite conserva memoria,
conocimiento e índices locales. La asignación detallada vive en
[la norma de datos](../standards/database.md).

## Capacidades principales

- WhatsApp y herramientas del agente: `electron/whatsapp/`, `wa-agent/` y `wa-tools/`.
- Reuniones y artefactos: `electron/meetings/` y `meeting-live/`.
- Automatización visual: `electron/desktop-agent/`.
- Google Workspace: módulos `calendar/`, `gmail/`, `drive/` y `gchat/`.
- Memoria y búsqueda: módulos `memory/`, `knowledge/` y `semantic-indexer/`.
- Renderer: `src/app/`, `src/components/`, `src/hooks/`, `src/services/` y
  `src/adapters/`.
- Sidecars: `python/sidecar/` y `python/tools_sidecar/`.

## Seguridad

La allowlist de preload, la sanitización en main y las políticas RLS son fronteras
ejecutables. Las instrucciones del modelo no conceden permisos. Operaciones críticas
requieren HITL; los grupos de WhatsApp mantienen bloqueadas las capacidades peligrosas.

## Desarrollo asistido

El arnés vive en `ai-specs/`; el estado durable del cambio en `openspec/`; Git conserva
el código y aislamiento. Consulta [el mapa de módulos](module-map.md) para rutas concretas.
