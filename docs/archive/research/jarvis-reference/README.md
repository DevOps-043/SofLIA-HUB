# Referencia extraida de Jarvis-FreeV3 (2026-07-06)

`contextual_control.py.txt` era el unico modulo de Jarvis con valor pendiente de portar.
La extension `.txt` es intencional: es un archivo de referencia historica, no codigo
activo del proyecto (asi los analizadores de Python del IDE no lo reportan).

**Ya portado (2026-07-08):** la logica vive en TypeScript/PowerShell como el tool
`contextual_control` del agente WhatsApp:

- Executor: `electron/whatsapp-executors/system-executors/contextual-control.ts`
- Declaracion: `electron/wa-tools/system/device-control.ts`
- Presets: reunion / foco / multimedia / gaming / normal

El resto del proyecto Jarvis se descarto: camara y vision eran stubs vacios,
y las demas funciones ya existen mejor en SofLIA. La carpeta Jarvis-FreeV3 fue eliminada.
