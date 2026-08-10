# Configuracion, secretos y estado local

Estado: vigente. Actualizado: 2026-08-06.

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
| `VITE_LEARNING_BASE_URL` | inicio de sesion federado con SofLIA Learning | la entrada federada no se ofrece; el inicio por contrasena no cambia | publica |
| `VITE_LEARNING_SSO_ENABLED` | interruptor de la entrada federada | ausente o distinto de `true`, la entrada no se monta y los retornos del flujo se ignoran | no secreta; es la bandera de rollback del cambio |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Calendar/Workspace OAuth | no se puede conectar Google | identificador publico |
| `VITE_GOOGLE_OAUTH_CLIENT_SECRET` | OAuth desktop | conexion falla | secreto; riesgo de bundle por `VITE_` |
| `VITE_MICROSOFT_CLIENT_ID` | Microsoft Calendar | no se puede conectar | identificador publico |
| `ELEVENLABS_API_KEY` | Orbe y modo lectura, solo Electron main | la Orbe conserva texto sin voz; el lector visual funciona sin narración | secreta; no llega a renderer/preload, pero una app Electron distribuida no sustituye un proxy secreto |
| `ELEVENLABS_VOICE_ID` | Orbe y modo lectura, solo Electron main | narración no disponible | identificador no secreto; la voz debe estar disponible en el mismo workspace de la clave |
| `ELEVENLABS_MODEL_ID` | Orbe y modo lectura, solo Electron main | default `eleven_turbo_v2_5` | no secreta |
| `ELEVENLABS_OUTPUT_FORMAT` | Orbe y modo lectura, solo Electron main | default `mp3_44100_128` | no secreta |
| `VITE_SKILL_PRESENTACIONES_ENABLED` | habilita la Skill de presentaciones en chat y WhatsApp | la Skill no aparece en el catálogo y `/presentacion` responde que no está disponible; el resto de Skills sigue operativo | no secreta; es la bandera de rollback del cambio |
| `VITE_DEV_SERVER_URL` | bootstrap dev | usa renderer build si falta | no secreta, gestionada por Vite |
| `VITE_PUBLIC` | paths de recursos | calculada por main | no configurar manualmente |

`ELEVENLABS_OUTPUT_FORMAT` define el transporte que el reproductor decodifica;
no habilita una descarga de archivo. El modo lectura no expone canal ni botón de
guardado. Una voz encontrada en el catálogo público debe agregarse primero al
workspace asociado con `ELEVENLABS_API_KEY`; una búsqueda en “Explorar” no
garantiza acceso mediante API.

## Archivos `userData`

| Archivo/directorio | Productor | Contenido |
|---|---|---|
| `soflia-memory.db` | MemoryService | conversacion/resumen/embeddings/facts y memoria aprendida (tabla `skills`, distinta del catalogo de Skills invocables) |
| `thoughts.db` | ThoughtLogger | eventos por task/agent |
| `knowledge/` | Knowledge/PathMemory | MEMORY, users, daily y PATHS |
| `desktop-agent-config.json` | Desktop Agent | engine, modelos, captura, limites, UIA/OCR |
| `proactive-config.json` | Proactive | enabled, hours, interval, categories |
| `scheduler-state.json` | TaskScheduler | cron, prompt, owner/telefono, last run |
| `communication-hub-state.json` | Communication Hub | policy, identity bindings, prefs, audit, scheduled |
| estados de workflow/automation | services respectivos | templates, runs, cases y reglas |
| auth WhatsApp | WhatsAppService/Baileys | credenciales de sesion |
| screenshots monitoring | MonitoringService | PNG/JPEG retenidas si habilita |
| `skill-workspaces/` | SkillWorkspaceService | `workspaces.json` (indice) y una carpeta por entregable bajo `presentaciones/<id>/`. Limites por skill: 512 KB por archivo, 8 MB y 60 archivos por workspace. El usuario puede abrirla y borrarla desde el panel. |

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

## Inicio de sesión federado con SofLIA Learning

El Hub no implementa el SSO de Google ni de Microsoft: lo delega en Learning, que
ya lo ejecuta con sus propias credenciales. En el Hub solo se configuran
`VITE_LEARNING_BASE_URL` y `VITE_LEARNING_SSO_ENABLED`; **ninguna clave del
proveedor de identidad debe llegar a este repositorio**, porque toda variable con
prefijo `VITE_` viaja en claro dentro del bundle distribuido.

Del lado de Learning hace falta la migración `desktop-sso-tickets` aplicada en el
proyecto SOFIA. El intercambio usa su cliente administrativo existente, así que
no introduce secretos nuevos.

Orden de despliegue obligatorio: migración y Learning primero, luego el Hub con
`VITE_LEARNING_SSO_ENABLED` sin definir, y encender el interruptor solo tras
verificar el flujo contra el despliegue. La reversión es apagarlo, lo que
devuelve el inicio por contraseña como única vía sin publicar versión.

## Carga de entorno

Vite `loadEnv` carga el prefijo público `VITE_`; además, la configuración de
build carga `ELEVENLABS_*` en un conjunto main-only. El primer conjunto se
define en main y preload; el segundo solo en main y nunca queda disponible en
`import.meta.env`. En desarrollo, `electron/main/environment.ts` intenta `.env`
relativo al bundle y establece `APP_ROOT`, `VITE_DEV_SERVER_URL` y `VITE_PUBLIC`.
La app empaquetada no incluye `.env`; el workflow de release crea uno temporal
desde GitHub Secrets antes del build.

## Operacion segura

- Nunca usar service role Supabase en `VITE_*`.
- No renombrar `ELEVENLABS_API_KEY` con prefijo `VITE_`: eso la expondría al
  entorno público del renderer. Para una frontera de secreto fuerte en clientes
  distribuidos, enrutar la síntesis mediante un backend autenticado.
- La clave restringida sólo necesita **De texto a voz: Acceso** cuando el
  `ELEVENLABS_VOICE_ID` y el modelo ya están configurados. No necesita voz a
  voz, STT, administración, escritura de voces ni acceso a modelos.
- Rotar una key comprometida en el proveedor y reconstruir releases que la
  hayan incrustado.
- No versionar `.env*`, JSON de `userData`, QR, tokens ni screenshots.
- Al reportar config, mostrar `configured: true/false`, provider y expiry; no valor.
- Cambiar defaults persistentes requiere migrar JSON previo o mantener fallback de
  compatibilidad, como `captureStrategy` de Desktop Agent.
