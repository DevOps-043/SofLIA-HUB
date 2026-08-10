## 1. Proveedor y contrato main

- [x] 1.1 Extraer configuración y errores ElevenLabs compartidos con default `eleven_turbo_v2_5`.
- [x] 1.2 Sustituir Google TTS en la Orbe por síntesis ElevenLabs MP3 con timeout y límites.
- [x] 1.3 Endurecer `orb:synthesize` con autenticación, sender permitido y validación de texto.

## 2. Renderer y reproducción

- [x] 2.1 Actualizar el contrato tipado del audio de la Orbe y retirar el adaptador WAV de Google.
- [x] 2.2 Decodificar MP3 con Web Audio y conservar cola, orden, animación y cancelación del turno.
- [x] 2.3 Actualizar el pipeline y los mensajes visibles para referirse a ElevenLabs.

## 3. Configuración y documentación

- [x] 3.1 Retirar `VITE_GOOGLE_CLOUD_TTS_*` del código y release, sin modificar secretos locales.
- [x] 3.2 Actualizar configuración, arquitectura, seguridad, README y changelog.

## 4. Evidencia y cierre

- [x] 4.1 Cubrir proveedor, handler, errores, permisos y reproducción con pruebas focalizadas.
- [x] 4.2 Ejecutar typecheck, documentación, OpenSpec y compuerta PR.
- [x] 4.3 Realizar revisión adversarial y registrar evidencia/riesgo residual.
