## Contexto

El agente de WhatsApp ya resuelve un turno completo con 133 herramientas,
guardas duras, confirmaciones HITL y permisos por remitente. Lo único que falta
para sostener una conversación hablada es el **transporte de audio de salida** y
una **política de sesión** que decida cuándo responder hablando.

## Decisiones

### D1. El transporte es por notas de voz, no una llamada nativa

Baileys reimplementa el protocolo de WhatsApp Web y expone de llamadas solo la
señalización: `WACallEvent` (`offer`, `ringing`, `preaccept`, `transport`,
`relaylatency`, `timeout`, `reject`, `accept`, `terminate`) y
`rejectCall(callId, callFrom)`. No hay plano de medios: el audio de una llamada
de WhatsApp viaja por WebRTC con cifrado extremo a extremo que la librería no
implementa.

Alternativa descartada: **WhatsApp Business Calling API** (Cloud API de Meta,
WebRTC con ICE + DTLS + SRTP). Es la única vía a una llamada real, pero exige que
el número esté registrado en Cloud API y **no** en la app de WhatsApp, más
webhook público, tier de 2.000 destinatarios diarios y verificación de negocio.
Registrar el número actual lo expulsaría de la app y dejaría a Baileys sin
sesión, tumbando el canal de mensajes completo. Queda para un cambio aparte con
un número dedicado.

Consecuencia asumida: la conversación es **semi-dúplex**, por turnos. No hay
interrupción a media frase.

### D2. ElevenLabs aporta la voz, no la conversación

El WebSocket de ElevenLabs Agents (`wss://api.elevenlabs.io/v1/convai/conversation`)
daría interrupción natural y latencia sub-segundo, pero sus formatos de salida
son `pcm_8000..48000` y `ulaw_8000`. Convertir eso a lo que WhatsApp acepta como
nota de voz exigiría un codificador Opus nativo; el repositorio no tiene ffmpeg y
añadir un binario nativo por plataforma es desproporcionado para un transporte
que además no tiene stream continuo que interrumpir.

La REST de texto a voz sí entrega `opus_48000_64` en contenedor OGG, exactamente
el formato que WhatsApp PTT y Telegram `sendVoice` consumen sin transcodificar.
Baileys deriva la duración con `music-metadata`, que lee OGG sin ayuda externa;
igual se envía `seconds` explícito para no depender de ello.

Alternativa descartada: MP3. WhatsApp lo acepta como archivo de audio pero no lo
presenta de forma fiable como nota de voz (`ptt`), que es la forma que el usuario
espera al conversar.

### D3. El cerebro sigue siendo el loop Gemini existente

El modo llamada **no** introduce un segundo agente. Cada turno hablado entra por
la misma ruta que un mensaje de texto (`handleMessage`), así que hereda sin
duplicación: prefiltro de seguridad, visibilidad de herramientas por permisos,
bloqueo en grupos, confirmaciones HITL y skills. La única diferencia es la
**forma de entrega** de la respuesta.

Esto mantiene una sola política de agente y evita que el catálogo de herramientas
viva fuera del repositorio.

### D4. La sesión de llamada es política de entrega, no de razonamiento

`VoiceCallSessionStore` guarda por `(canal, chatId)` si el modo está activo, con
vencimiento por inactividad. Su única consulta es: *¿esta respuesta sale hablada?*

Una respuesta sale hablada cuando el modo llamada está activo **o** el turno
entró por audio. Así, hablarle una vez basta para que conteste hablando, sin
comando previo.

### D5. La llamada entrante se rechaza y se reconduce

Dejar timbrar sin respuesta es peor que rechazar: WhatsApp reintenta y el usuario
no recibe señal. Al llegar un `call` con `status === 'offer'` de un número
autorizado, se rechaza y se abre el modo llamada con un saludo hablado que
explica que puede hablarle por nota de voz. El rechazo es inmediato para que el
timbre no se prolongue.

Los `offer` de números no autorizados se rechazan sin abrir sesión ni responder,
igual que el filtro de mensajes.

### D6. Límites y degradación

- El texto hablado se recorta a `VOICE_NOTE_MAX_CHARS`; el resto se entrega como
  texto en el mismo turno, para no perder contenido ni generar notas eternas.
- Si ElevenLabs falla o no está configurado, la respuesta **cae a texto** con un
  aviso una sola vez por sesión. Una llamada sin voz sigue siendo una
  conversación útil; perder la respuesta no lo es.
- La síntesis tiene timeout propio y tope de bytes, como la orbe.

## Migración

Cambio puramente aditivo. Sin migraciones de datos ni de esquema. `sendText`
conserva su firma y comportamiento; la orbe conserva MP3 porque el formato de
salida es un parámetro opcional con el valor de configuración como omisión.

## Rollback

El modo llamada se desactiva con `VOICE_CALL_ENABLED=false`: el transporte deja
de emitir audio, el detector de llamadas se desregistra y todo vuelve a texto. La
retirada completa es eliminar `electron/voice-call/` y las llamadas a
`sendVoiceNote`, sin residuo en datos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Créditos de ElevenLabs agotados a mitad de conversación | Caída a texto con aviso único por sesión; el error de proveedor ya viene saneado. |
| Sesión de llamada abierta indefinidamente consumiendo voz | Vencimiento por inactividad y `/colgar` explícito. |
| Voz activada en un grupo por error | El modo llamada solo se abre en DM. |
| Nota de voz demasiado larga | Recorte con entrega del resto en texto. |
| Confirmación HITL pedida por voz y no entendida | La confirmación se envía **también** en texto, que es el canal donde se lee sin ambigüedad. |
