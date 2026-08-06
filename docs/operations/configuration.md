# Configuracion, secretos y estado local

Estado: vigente. Actualizado: 2026-08-04.

No se leen ni documentan valores de `.env`. Esta pagina registra solo nombres,
consumidores y comportamiento cuando faltan.

<!-- evidence: src/config.ts -->
<!-- evidence: config/vite/env-defines.mts -->
<!-- evidence: electron/main/environment.ts -->

## Variables de build/runtime

| Variable | Consumidor | Necesidad/ausencia | Sensibilidad |
|---|---|---|---|
| `VITE_GEMINI_API_KEY` | chat, WhatsApp, meetings, memoria, vision | IA queda no configurada o usa key guardada de WhatsApp en rutas compatibles | secreta, pero prefijo Vite puede exponerla al bundle |
| `VITE_WHATSAPP_GEMINI_MODEL` | configuracion del agente WA | override opcional; defaults en codigo | no secreta |
| `VITE_SUPABASE_URL` | Lia renderer/main | chat/Hub degradados sin URL valida | publica |
| `VITE_SUPABASE_ANON_KEY` | Lia renderer/main | cliente no se configura | publica condicionada a RLS |
| `VITE_SOFIA_SUPABASE_URL` | auth SOFIA | auth principal no disponible | publica |
| `VITE_SOFIA_SUPABASE_ANON_KEY` | auth SOFIA | auth principal no disponible | publica condicionada a RLS |
| `VITE_IRIS_SUPABASE_URL` | Project Hub/IRIS tools | IRIS degradado | publica |
| `VITE_IRIS_SUPABASE_ANON_KEY` | Project Hub/IRIS tools | IRIS degradado | publica condicionada a RLS |
| `VITE_SOFLIA_LEARNING_SUPABASE_URL` | servicio Learning | servicio no disponible | publica |
| `VITE_SOFLIA_LEARNING_SUPABASE_ANON_KEY` | servicio Learning | servicio no disponible | publica condicionada a RLS |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Calendar/Workspace OAuth | no se puede conectar Google | identificador publico |
| `VITE_GOOGLE_OAUTH_CLIENT_SECRET` | OAuth desktop | conexion falla | secreto; riesgo de bundle por `VITE_` |
| `VITE_MICROSOFT_CLIENT_ID` | Microsoft Calendar | no se puede conectar | identificador publico |
| `VITE_GAMMA_API_KEY` | generacion de presentaciones | workflow falla sin artifact | secreta; riesgo de bundle |
| `VITE_GOOGLE_CLOUD_TTS_API_KEY` | TTS orbe | voz cloud no disponible | secreta; riesgo de bundle |
| `VITE_GOOGLE_CLOUD_TTS_VOICE` | TTS | default `es-US-Chirp3-HD-Aoede` | no secreta |
| `VITE_GOOGLE_CLOUD_TTS_LANGUAGE` | TTS | default `es-US` | no secreta |
| `VITE_CHAT_TTS_PROVIDER` | renderer/orbe | usa default del servicio | no secreta |
| `VITE_DEV_SERVER_URL` | bootstrap dev | usa renderer build si falta | no secreta, gestionada por Vite |
| `VITE_PUBLIC` | paths de recursos | calculada por main | no configurar manualmente |

## Archivos `userData`

| Archivo/directorio | Productor | Contenido |
|---|---|---|
| `soflia-memory.db` | MemoryService | conversacion/resumen/embeddings/facts/skills |
| `thoughts.db` | ThoughtLogger | eventos por task/agent |
| `knowledge/` | Knowledge/PathMemory | MEMORY, users, daily y PATHS |
| `desktop-agent-config.json` | Desktop Agent | engine, modelos, captura, limites, UIA/OCR |
| `proactive-config.json` | Proactive | enabled, hours, interval, categories |
| `scheduler-state.json` | TaskScheduler | cron, prompt, owner/telefono, last run |
| `communication-hub-state.json` | Communication Hub | policy, identity bindings, prefs, audit, scheduled |
| estados de workflow/automation | services respectivos | templates, runs, cases y reglas |
| auth WhatsApp | WhatsAppService/Baileys | credenciales de sesion |
| screenshots monitoring | MonitoringService | PNG/JPEG retenidas si habilita |

Los nombres exactos adicionales se resuelven en cada servicio con
`app.getPath('userData')`. No deben codificarse rutas absolutas del equipo.

## Secretos de funciones backend

`sofia-session-exchange`, desplegada en Lia, requiere `SOFIA_SUPABASE_URL` y
`SOFIA_SUPABASE_ANON_KEY` en el gestor de secretos de funciones. La URL y clave
administrativa Lia son provistas por el entorno Supabase. Ninguna se declara con
prefijo `VITE_`, se copia a Electron o se versiona con valores.

La función acepta un JWT emitido por otro proyecto, por lo que desactiva la
validación del gateway Lia y autentica explícitamente contra SOFIA dentro del
handler. Desactivar el gateway sin esa validación interna es una configuración
insegura y no autorizada.

## Carga de entorno

Vite `loadEnv` carga prefijo `VITE_` y `createMainProcessEnvDefines` incrusta
valores en main. En desarrollo, `electron/main/environment.ts` intenta `.env`
relativo al bundle y establece `APP_ROOT`, `VITE_DEV_SERVER_URL` y `VITE_PUBLIC`.
La app empaquetada no incluye `.env`; el workflow de release crea uno temporal
desde GitHub Secrets antes del build.

## Operacion segura

- Nunca usar service role Supabase en `VITE_*`.
- Rotar una key comprometida en el proveedor y reconstruir releases que la
  hayan incrustado.
- No versionar `.env*`, JSON de `userData`, QR, tokens ni screenshots.
- Al reportar config, mostrar `configured: true/false`, provider y expiry; no valor.
- Cambiar defaults persistentes requiere migrar JSON previo o mantener fallback de
  compatibilidad, como `captureStrategy` de Desktop Agent.
