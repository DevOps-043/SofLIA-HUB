## Purpose

Define una voz consistente y segura para la Orbe mediante ElevenLabs, con baja latencia, configuración main-only y degradación visible cuando el proveedor no está disponible.

## ADDED Requirements

### Requirement: Síntesis ElevenLabs para la Orbe
El sistema SHALL sintetizar las respuestas habladas de la Orbe con la voz identificada por `ELEVENLABS_VOICE_ID` y SHALL usar el modelo configurado, cuyo valor por defecto MUST ser `eleven_turbo_v2_5`.

#### Scenario: Respuesta hablada correcta
- **WHEN** la Orbe recibe texto válido y ElevenLabs está configurado
- **THEN** el sistema genera audio con la voz y modelo configurados, lo reproduce en orden y vuelve a escuchar al terminar

#### Scenario: Respuesta larga por segmentos
- **WHEN** la respuesta supera el tamaño de un segmento de voz
- **THEN** el sistema sintetiza segmentos acotados en paralelo, los reproduce en el orden original y permite cancelar el turno vigente

### Requirement: Credencial confinada a Electron main
La API key de ElevenLabs MUST permanecer en Electron main, MUST enviarse al proveedor únicamente en el encabezado de autenticación y MUST NOT exponerse mediante variables `VITE_*`, preload, renderer, logs o respuestas IPC.

#### Scenario: Síntesis desde la Orbe
- **WHEN** un renderer autorizado solicita síntesis
- **THEN** el renderer recibe únicamente audio codificado y metadatos no secretos

#### Scenario: Renderer no autorizado
- **WHEN** un sender distinto de la ventana principal o la Orbe invoca el canal de síntesis
- **THEN** el sistema rechaza la solicitud sin llamar a ElevenLabs

### Requirement: Configuración y errores controlados
El sistema MUST validar texto, voz, modelo y formato antes de llamar al proveedor, SHALL aplicar timeout y límites de respuesta, y SHALL devolver mensajes saneados para credencial inválida, permiso insuficiente, cuota agotada, timeout y fallo temporal.

#### Scenario: Configuración incompleta
- **WHEN** falta la API key o el identificador de voz
- **THEN** la respuesta escrita permanece visible y la Orbe informa que la voz no está configurada sin recurrir a Google TTS

#### Scenario: Permiso o cuota rechazados
- **WHEN** ElevenLabs responde con autorización insuficiente o límite de uso
- **THEN** el sistema muestra un error accionable y no filtra el cuerpo interno del proveedor

### Requirement: Retiro de Google Cloud TTS
El sistema MUST NOT usar Google Cloud Text-to-Speech para la voz de la Orbe y MUST NOT requerir `VITE_GOOGLE_CLOUD_TTS_API_KEY`, `VITE_GOOGLE_CLOUD_TTS_VOICE` ni `VITE_GOOGLE_CLOUD_TTS_LANGUAGE` en desarrollo o release.

#### Scenario: Aplicación configurada sólo con ElevenLabs
- **WHEN** Pulse Hub se ejecuta sin variables Google TTS y con `ELEVENLABS_API_KEY` y `ELEVENLABS_VOICE_ID`
- **THEN** la Orbe y el modo lectura pueden sintetizar voz sin degradar a Google TTS
