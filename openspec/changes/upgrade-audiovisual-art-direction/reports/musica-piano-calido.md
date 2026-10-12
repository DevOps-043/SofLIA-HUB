# Nueva composición: piano cálido

Fecha: 12 de octubre de 2026. Base: 0ec284a. Estado: implementación y verificación completadas. Petición: rehacer la música sin cambiar el video.

Se sustituyó el arpegio electrónico, melodía FM, caja, hi-hat y eco rítmico por
piano sintético de parciales amortiguados, armonías de triángulo filtradas,
bajo sinusoidal sostenido y pulso grave discreto. La melodía tiene frases
espaciadas y registro medio; los efectos visuales son suaves y no agregan
pitidos agudos. La resolución comparte el final de la transición de marca.
El piano es síntesis propia, no una grabación o un instrumento acústico sampleado.
No se añadieron dependencias, descargas, claves ni cambios de configuración.

Se conserva la arquitectura: Web Audio offline, PCM24 estéreo a 48 kHz, master
con ganancia fija/limitador y medición AAC. Las voces internas de la partitura
no son un nuevo campo ni versión de film.json. El compositor anterior se reemplaza;
no existe un segundo motor musical ni código generado por el modelo.

## Evidencia

- `--audio-only --film=test/fixtures/audiovisual-polish.json`: 30 s, 1440000
  muestras por canal, 76 eventos. AAC −14.00 LUFS, −2.50 dBTP, LRA 4.2 LU.
  Dos síntesis difieren como máximo 0.0000134 de amplitud.
- Caso nativo 6 s/140 BPM: síntesis y AAC válidos, 288000 muestras por canal,
  −14.01 LUFS, −4.40 dBTP. Silencio real: muestras exactamente cero, sin eventos,
  PCM y AAC producidos; el smoke ahora respeta esa selección al masterizar.
- Caso nativo 60 s/80 BPM: 2880000 muestras por canal y 94 eventos,
  −14.02 LUFS, −2.50 dBTP, LRA 5.7 LU. Dentro del mismo contrato.
- Seis pruebas focalizadas de partitura y transporte QA pasaron; nueva regresión
  exige piano, ausencia de voces electrónicas retiradas, descansos y resolución.
- `npm run verify:pr`: pasó, 400 archivos de suite exitosos y uno omitido;
  4214 pruebas exitosas y una omitida. Incluye typecheck, lint de cuatro archivos
  sin deuda nueva, harness, documentación, semilla y OpenSpec estricto.
  `npm run build:app` pasó en el worktree aislado. Revisión independiente limpia.

La entrega conserva el video aprobado mediante `-c:v copy`: se verifica el
SHA256 del flujo de paquetes de video del archivo anterior y del nuevo, idénticos.
No se recodifican imágenes. El MP4 tiene 30 s, 1800 frames, 1920×1080 a 60 fps,
H.264 y AAC estéreo 48 kHz. Se verifican todos los PTS (error máximo 3.34×10⁻⁷ s),
codec, formato, sonoridad y decodificación completa. Chromium headless local
reprodujo 0–30 s y seek a 15 s, con 3 frames descartados. Esta prueba
usa un archivo local, sin el panel React del Hub. No es una generación nueva
del modelo ni se sobrescribe el informe protegido de un workspace del usuario.

Hash del MP4 nuevo:
`34f9168c9d0f5913b51705392c01d75154037cc24067ea65dfca1f104809829d`.
Hash del MP4 anterior:
`191d2f34d9e99a114fc8590964ff39a817c845cbd1c3e2d197364153bd675b74`.

Evidencia ignorada en `production-smoke/musica-calida-final` y
`production-smoke/musica-limites`; entrega nueva en
`Downloads/SofLIA-musica-calida-2026-10-12`. Se incluye la pista de audio separada.
Los niveles técnicos no demuestran agrado musical. Se ofrece la nueva pista
para escucha del usuario; no se declara una evaluación auditiva humana.

## Consulta sobre skills personales

La capacidad sistema audiovisual está integrada y se activa con `/video`.
El usuario puede guardar un brief y reglas de flujo en una skill personal, pero
hoy no puede exportar un video directamente desde ella: [active-skill.ts](../../../../src/services/skills/active-skill.ts)
prepara workspace y herramientas para skills del sistema, y
[skill-workspace-tools.ts](../../../../src/services/gemini-chat/skill-workspace-tools.ts)
exige sistema:audiovisual para inspect/render. Se puede entregar ese brief a
`/video` para producir una demostración conceptual. No se graba automáticamente
la pantalla real. Esta tarea responde la consulta y no modifica permisos ni
implementa una skill personal o grabador.

## Integración

Código integrado en `cb6b4b8` mediante fast-forward. Los 55 archivos concurrentes
registrados conservaron sus hashes en la integración. El runtime audiovisual
recompilado en el principal coincide con el probado; la compilación completa y
compuerta corresponden al worktree aislado, sin atribuir validación al trabajo
ajeno del principal. Reiniciar el Hub en desarrollo carga la música nueva.
No se publicó instalador ni se modificó la activación de skills personales.
