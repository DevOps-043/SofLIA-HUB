# Mapa de modulos

## Procesos

- `electron/main.ts`: bootstrap del proceso principal.
- `electron/main/`: ciclo de vida, ventanas, servicios y eventos.
- `electron/preload.ts`: composicion de APIs seguras.
- `electron/preload/`: allowlist y exposicion por dominio.
- `src/app/`: composicion del renderer.
- `python/sidecar/`: voz y transcripcion.
- `python/tools_sidecar/`: documentos y privacidad.

## Dominios principales

- WhatsApp y agente: `electron/whatsapp/`, `electron/wa-agent/`,
  `electron/wa-tools/`.
- Desktop Agent: `electron/desktop-agent/`.
- Reuniones: `electron/meetings/` y `electron/meeting-live/`.
- Google Workspace: `electron/calendar/`, `gmail/`, `drive/`, `gchat/`.
- Memoria: `electron/memory/`, `knowledge/`, `semantic-indexer/`.
- Herramientas runtime gobernadas: `electron/mcp-manager/`,
  `electron/dynamic-tool/` y
  [contrato de plugins dinámicos](runtime-dynamic-tools.md).
- Renderer: composicion en `src/app/`, pantallas en `src/components/`, estado en
  `src/hooks/`, contratos en `src/services/` y adaptadores migrados en
  `src/adapters/`.

Los archivos pequenos de reexportacion en la raiz son facades de compatibilidad.
No agregar nuevas facades sin una razon de migracion documentada.
