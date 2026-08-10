## Why

La Orbe todavía depende de Google Cloud Text-to-Speech y mantiene una segunda configuración de voz expuesta como variables `VITE_*`, mientras el modo lectura ya usa ElevenLabs desde Electron main. Unificar ambos flujos permite usar la voz elegida por producto, reducir proveedores y mantener la credencial fuera del renderer.

## What Changes

- Sustituir Google Cloud TTS por ElevenLabs para todas las respuestas habladas de la Orbe.
- Usar `ELEVENLABS_VOICE_ID` y `eleven_turbo_v2_5` como modelo de síntesis configurable, con audio MP3 reproducido por Web Audio.
- Compartir configuración, validación, timeout y errores saneados entre la Orbe y el modo lectura sin añadir un SDK.
- Retirar variables, código, documentación y secretos de release exclusivos de Google TTS.
- Conservar reconocimiento de voz, wake word y demás servicios Google/Gemini fuera del alcance.

## Capabilities

### New Capabilities

- `orb-elevenlabs-voice`: síntesis segura y de baja latencia de las respuestas de la Orbe mediante una voz ElevenLabs configurada en Electron main.

### Modified Capabilities


## Impact

- Electron main: proveedor ElevenLabs compartido y handler `orb:synthesize` existente.
- Renderer: decodificación y reproducción ordenada de audio MP3 en la Orbe.
- Configuración/release: eliminación de `VITE_GOOGLE_CLOUD_TTS_*`; reutilización de `ELEVENLABS_*`.
- Seguridad: la API key deja de formar parte de variables públicas `VITE_*`; no se imprime ni se entrega al preload o renderer.
- Documentación y pruebas: contratos de voz, errores, límites y configuración.
