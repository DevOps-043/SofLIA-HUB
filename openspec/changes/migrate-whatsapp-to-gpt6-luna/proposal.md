## Why
El usuario solicita GPT-6 Luna para WhatsApp y su generador de presentaciones, incluidos los especialistas. Actualmente esas rutas llaman al SDK Gemini.
## What Changes
- Cambiar coordinador y especialistas a Responses con gpt-6-luna.
- Adaptar llamadas/resultados de herramientas conservando ejecutor, HITL y filtros de grupos.
- Resolver la credencial OpenAI de la sesión del Hub en main; mantener Gemini para transcripción y Computer Use.
## Capabilities
### New Capabilities
- `whatsapp-luna`: Conversaciones y presentaciones con Luna.
### Modified Capabilities
## Impact
WhatsApp, generador de decks, inicio del agente, pruebas y documentación. Sin migraciones ni canales IPC nuevos.
