## Why

SofLIA ya escucha por WhatsApp: `handleWhatsAppAudioMessage` transcribe la nota de
voz y la reinyecta por la ruta de texto. Pero **nunca contesta hablando**:
`electron/whatsapp/send.ts` solo emite texto, imagen, video y documento, y el
canal de Telegram descarta todo update que no traiga `text`. La conversación es
asimétrica: el usuario puede hablarle, ella solo escribe.

El usuario pide sostener una conversación hablada continua desde WhatsApp o
Telegram, con el mismo alcance que la orbe: búsqueda web, herramientas, skills y
computer use ejecutables durante la charla.

## Non-Goals

- **No** se implementa una llamada nativa de WhatsApp. Baileys expone únicamente
  la señalización (`WACallEvent` con `offer`/`ringing`/`terminate` y
  `rejectCall`); no implementa el plano de medios WebRTC, así que no existe
  acceso al audio de una llamada. La única vía real sería la WhatsApp Business
  Calling API sobre Cloud API, que exige sacar el número de la app de WhatsApp y
  dejaría a Baileys sin sesión, tumbando el agente de mensajes actual.
- **No** se usa el WebSocket de ElevenLabs Agents en esta fase: solo emite
  `pcm_*` y `ulaw_8000`, lo que obligaría a un codificador Opus nativo que el
  repositorio no tiene (no hay ffmpeg) sin ganar interrupción, porque el
  transporte es por turnos.
- **No** se cambia el cerebro del agente. El loop Gemini de `wa-agent/` sigue
  siendo el único que razona y ejecuta herramientas, con sus guardas,
  confirmaciones y permisos intactos.
- **No** se habilita voz en grupos por defecto.

## What Changes

- Permitir a `requestElevenLabsSpeech` un formato de salida por llamada para
  obtener `opus_48000_64` en contenedor OGG, que WhatsApp PTT y Telegram
  `sendVoice` consumen sin transcodificar. La orbe conserva MP3.
- Nuevo `electron/voice-call/`: síntesis de nota de voz y registro de sesiones de
  modo llamada por canal y chat, con vencimiento por inactividad.
- Salida de voz en ambos canales: `sendVoiceNote` en WhatsApp (PTT) y `sendVoice`
  en Telegram, ambas registradas en el historial de conversación.
- Entrada de voz en Telegram: aceptar updates con `voice`/`audio`, descargarlos
  con `getFile` y transcribirlos por la misma ruta que WhatsApp.
- Modo llamada: mientras está activo, cada respuesta del agente sale hablada y el
  contexto se mantiene. Se abre con `/llamar`, al hablarle por nota de voz, o al
  detectar una llamada entrante de WhatsApp; se cierra con `/colgar` o por
  inactividad.
- Detección de llamada entrante: `ev.on('call')` rechaza el `offer` y abre el
  modo llamada con un saludo hablado, en vez de dejar el timbre sin respuesta.
- Nueva herramienta `send_voice_note` para que el agente decida hablar dentro de
  un turno.

## Capabilities

### New Capabilities

- `voice-call-mode`: conversación hablada sostenida por WhatsApp y Telegram, con
  el catálogo completo de herramientas del agente disponible durante la charla.

### Modified Capabilities

- Agente de WhatsApp: gana salida hablada y una herramienta de entrega por voz.
- Canal de Telegram: gana entrada y salida de audio.

## Impact

- Electron main: `elevenlabs-tts.ts`, nuevo módulo `voice-call/`, transporte de
  WhatsApp y Telegram, declaraciones y despacho de herramientas.
- Configuración: `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID` ya existentes;
  variables opcionales nuevas para voz y límites del modo llamada.
- Seguridad: la voz sale por el mismo transporte ya autorizado; el modo llamada
  no altera permisos, guardas ni confirmaciones. Las acciones críticas siguen
  exigiendo HITL, que en voz se responde por texto o por voz transcrita.
- Documentación: `docs/architecture/runtime-agents-manual.md` (§3.3 audio, §3.12
  catálogo, §3.13 comandos) y configuración de operaciones.
- Pruebas: síntesis, transporte de ambos canales, ciclo de vida de sesión y
  rechazo de llamada.
