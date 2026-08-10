## Context

La Orbe llama `orb:synthesize` y recibe WAV LINEAR16 generado por Google Cloud, mientras el modo lectura ya usa ElevenLabs en main con MP3 y timestamps. La API de la Orbe debe conservarse para no romper preload, pero el proveedor y el formato pueden evolucionar mediante su contrato tipado. Véase `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Unificar voz de Orbe y lector en una configuración ElevenLabs main-only.
- Usar `eleven_turbo_v2_5` y la voz definida por `ELEVENLABS_VOICE_ID`.
- Mantener síntesis anticipada, orden de reproducción, animación de audio, cancelación y errores visibles.
- Eliminar secretos y configuración Google TTS del bundle y release.

**Non-Goals:**

- Cambiar el reconocimiento de voz, wake word, el modelo conversacional o Computer Use.
- Administrar, clonar o listar voces desde Pulse Hub.
- Migrar la síntesis local del sidecar usada por otros flujos no invocados por la Orbe.
- Probar una API key real o persistir secretos desde el repositorio.

## Decisions

### Configuración compartida, solicitudes especializadas

Un módulo main compartido valida `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` y `ELEVENLABS_OUTPUT_FORMAT`, con defaults `eleven_turbo_v2_5` y `mp3_44100_128`. La Orbe usa el endpoint binario estándar y el lector conserva `with-timestamps`; ambos reutilizan validación y traducción de errores. Esto evita acoplar el lector a un resultado que no necesita y evita añadir el SDK para dos endpoints simples.

Alternativa descartada: duplicar configuración en cada servicio, porque puede seleccionar voces/modelos distintos y divergir en errores. También se descarta incrustar la key como `VITE_*`, ya que quedaría disponible al renderer.

### MP3 decodificado por Web Audio

El handler mantiene `orb:synthesize`, pero devuelve MP3 Base64 y `mimeType`. `OrbTtsPlayback` decodifica cada bloque con `AudioContext.decodeAudioData`, lo encola con el mismo reloj y conserva el `GainNode` usado por la animación.

Alternativa descartada: pedir PCM a ElevenLabs, porque vincula la Orbe a un formato/plan específico y obliga a mantener una configuración distinta de la usada por el lector.

### Sender y payload cerrados

El handler aceptará sólo las ventanas principal u Orbe, con sesión autenticada, texto no vacío y tope explícito. La key nunca cruza IPC; los errores de proveedor se normalizan en main.

### Turbo explícito por decisión de producto

Aunque ElevenLabs recomienda Flash sobre Turbo para menor latencia, se respeta la decisión de producto de usar `eleven_turbo_v2_5`. El modelo queda configurable para una migración futura sin cambio de código.

## Risks / Trade-offs

- [MP3 requiere decodificación asíncrona] → iniciar síntesis durante el streaming y decodificar antes de encolar, conservando orden mediante la cadena existente.
- [Solicitudes paralelas consumen cuota] → mantener presupuesto total y tamaño de bloques, limitar texto por IPC y abortar efectos de turnos obsoletos.
- [Una clave empacada en Electron main puede extraerse del binario] → no exponerla al renderer y documentar que producción de alto riesgo debe usar un proxy backend; la migración mejora la situación frente a `VITE_*` pero no convierte el bundle en bóveda.
- [Turbo es un modelo legado según ElevenLabs] → mantenerlo configurable y documentar la recomendación futura de Flash sin cambiar la selección solicitada.

## Migration Plan

1. Introducir configuración ElevenLabs compartida y adaptar el lector sin cambiar su contrato.
2. Sustituir el proveedor de `orb:synthesize`, actualizar tipos y reproducción MP3.
3. Eliminar código/configuración Google TTS y secretos de release asociados.
4. Verificar pruebas focalizadas y compuerta PR.

Rollback: restaurar el proveedor anterior sólo mediante revert del cambio; no se mantiene fallback silencioso ni doble credencial en runtime.
