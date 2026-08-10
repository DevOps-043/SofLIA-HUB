# Evidencia de verificación

Fecha: 2026-08-06. Estado: aprobado.

## Casos focalizados

- Proveedor ElevenLabs: modelo/formato por defecto, voz configurada, header `xi-api-key`, MP3, permiso 403 saneado, ausencia de key, texto mayor a 5.000 caracteres, voz malformada y respuesta fuera de rango.
- IPC `orb:synthesize`: sesión, sender principal permitido, sender ajeno denegado, payload no string y ausencia de secretos en la respuesta.
- Renderer: wrapper acepta sólo `audio/mpeg`, decodificación Web Audio, orden/drain y descarte de decodificación posterior a cancelación.
- Regresión del lector: `with-timestamps` conserva offsets y ahora comparte `eleven_turbo_v2_5`.

## Comandos y resultados

- `npx vitest run ...orb... ...integrated-browser-reading-service...`: 24 pruebas focalizadas aprobadas.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: 51 archivos sin deuda nueva.
- `npm run docs:check`: 160 Markdown activos con enlaces válidos.
- `npm run docs:system:check`: 28 documentos, 144 IDs, 316 canales y 325 archivos de prueba.
- `npx openspec validate --all --strict --no-interactive`: 12 cambios válidos.
- `npm run build:app`: renderer, main y preload construidos correctamente; `elevenlabs-tts` queda en bundle main y no aparece en renderer/preload.
- `npm run verify:pr`: 149 archivos y 1.262 pruebas aprobadas.

## Revisión adversarial

Hipótesis intentadas y resultado:

- Un renderer ajeno puede consumir la cuota: refutada por validación de sender y sesión.
- La key llega a renderer/preload: refutada mediante búsqueda en los bundles compilados; sólo main contiene el proveedor.
- Texto vacío, objeto o excesivo llega a ElevenLabs: refutada por validación en handler y servicio.
- Una decodificación tardía revive audio cancelado: refutada con generación de playback y prueba dedicada.
- Un 403 filtra el cuerpo del proveedor: refutada; el mensaje público sólo indica permiso de texto a voz.
- Google TTS permanece como fallback: refutada en código, workflow de release y bundles.

## Riesgo residual

Una aplicación Electron distribuida no es una bóveda de secretos: una key
inyectada en el bundle main puede extraerse por un atacante local determinado.
Para distribución amplia se recomienda mover ElevenLabs detrás de un proxy
backend autenticado. `eleven_turbo_v2_5` se conserva por decisión de producto,
aunque el proveedor recomienda Flash para menor latencia.
