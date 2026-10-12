# Pulido de transiciones, música y destacados

Fecha: 12 de octubre de 2026. Base: 759747c. Estado: implementación y verificación completadas.

Se conserva el manifiesto del video autónomo Max que el usuario aprobó. El fixture
[audiovisual-polish.json](../../../../test/fixtures/audiovisual-polish.json) sólo
agrega destacados: contenido, entidades, estados, cámaras y cortes coinciden
exactamente con film-autonomo-max.json de la entrega anterior. No es una nueva
generación del modelo; es una nueva producción del mismo proyecto con el motor
pulido. No se modifican archivos originales, secretos ni configuraciones locales.

## Cambios

- Titulares salientes desaparecen antes de entrar los siguientes; las ventanas
  conservan un fundido continuo. El portal mantiene su geometría de cámara.
- El ecosistema completa el plegado en la primera fase del cierre; el fondo claro
  aparece después. La prueba exige que blanco visible implique plegado completo.
- `destacados` selecciona hasta tres frases literales por palabras completas, sin
  duplicados ni todo el titular. La paleta aqua y peso 600 refuerzan conocimiento,
  Inteligencia, trabajo, formación, capacidades y Nuevas posibilidades. El texto
  conserva contraste 4.5:1; acentos insuficientes utilizan el texto base. La opción
  es compatible: los manifiestos anteriores conservan el acento final automático.
- Música: fraseo con descansos, menos golpes y graves, caja con cuerpo tonal,
  agudos y modulación más suaves, ecos estéreo al tempo y bajo sin reverberación.
  La percusión y arpegios paran antes del cierre; la armonía final resuelve al
  terminar la transición. Ganancia fija y limitación mantienen el perfil de salida.
- Inspector revisa puntos intermedios de todos los cortes y separación de fases.
  El smoke admite `--film=<ruta>` para evaluar proyectos propios. Esta opción de
  desarrollo no se expone como ruta o ejecución de código al modelo runtime.

## Verificación

Pruebas focalizadas: 15 exitosas. Incluyen ausencia de titulares simultáneos,
plegado previo al blanco, cortes sin transición, destacados inválidos y contraste,
sincronía de transferencias, pausa de percusión y resolución, tempo 80/140 y una
película corta válida de seis segundos. La prueba de contexto QA conserva datos
con un film de 60 s, sin exigir un número fijo de notas musicales.

Audio nativo real: PCM24, estéreo, 48 kHz, 1440000 muestras por canal y 285 eventos.
AAC medido: −14.02 LUFS, −2.40 dBTP y LRA 5 LU. Antes, el Max aprobado tenía
LRA 4 LU a sonoridad equivalente. Dos síntesis difieren como máximo 0.0000154 de
amplitud. La revisión independiente confirma mediciones y no tiene hallazgos
pendientes. Las métricas no acreditan agrado musical ni una escucha humana.

Comandos:

- `node scripts/run-production-smoke.mjs production-smoke/pulido-audiovisual-audio --cinematic --audio-only --film=test/fixtures/audiovisual-polish.json`
- `node scripts/run-production-smoke.mjs production-smoke/pulido-audiovisual-v2 --cinematic --film=test/fixtures/audiovisual-polish.json`
- `npm run verify:pr`

El primer draft se detuvo con la guarda de hash al corregir la fase del cierre;
no publicó video. La salida final utiliza una carpeta nueva. Evidencia binaria
ignorada en production-smoke, fuera de Git. Salida real: 30 s, 1800 frames, 1920×1080, 60 fps, H.264/AAC estéreo, 13747346 bytes.
El MP4 confirma −14.02 LUFS, −2.40 dBTP y LRA 5 LU. PTS y decodificación completos.
Se observaron sus contactos: 20 frames comparados con React, diferencia media
máxima RGB 1.2665/255 a 320×180; 104 posiciones geométricas sin incidencias.
Caso negativo de titular fuera de la zona segura: detectado.

Playback con protocolo real en ventana headless sin panel React: seek a 15 s,
reproducción 0–30 s, mismo documento, cero frames descartados, 14 ediciones del
guion completadas y contenido original restaurado. Esto no es una prueba
integral del contenedor UI. El primer intento del harness necesitó sembrar el
guion de prueba, que el smoke ahora crea en su workspace nuevo.

Hashes:
- film: `a3c6cca7bd7010089382e6071b211e077c6b6defbc330304e8cf87e5e65e1286`
- runtime: `f222ec020cb5c2658567f4867976c97c204f65a56d1298977d285e592ff9bb1a`
- MP4: `191d2f34d9e99a114fc8590964ff39a817c845cbd1c3e2d197364153bd675b74`

La primera compuerta PR pasó 4213 pruebas. Una repetición bajo render concurrente
falló en el waitFor de un permiso del navegador integrado, cuyo código no cambió;
el caso aislado pasó. La repetición final pasó: 400 archivos de suite exitosos y uno omitido;
4213 pruebas exitosas y una omitida. Incluye typecheck, lint incremental sin
deuda nueva, harness, adapters, supply chain, documentación, semilla y OpenSpec.
No se marca la compuerta fallida como exitosa ni se modifica una prueba ajena.
`npm run build:app` pasó en el worktree aislado.

El repositorio principal contiene trabajo nuevo ajeno de la orbe y navegador.
La integración audiovisual conserva esos archivos y no los incorpora al commit.
La entrega nueva está en Downloads/SofLIA-pulido-audiovisual-2026-10-12 y no
sobrescribe los videos ni fuentes anteriores.

## Límites

El ajuste mantiene el repertorio React y la partitura sintética del producto;
no introduce música grabada, voz, clips externos, librerías ni un segundo motor.
Los tiempos y datos conceptuales del proyecto aprobado se conservan. La valoración
musical final pertenece al usuario; se ofrece un nuevo MP4 para escucharlo.

## Integración confirmada

Implementación integrada mediante fast-forward en `bfbb6d4`. Los 39 archivos
concurrentes registrados conservaron exactamente sus hashes tras la integración.
El bundle audiovisual recompilado en el checkout principal coincide con el
verificado. La compilación completa y compuerta se ejecutaron en el worktree
aislado; no se atribuye su resultado al trabajo ajeno pendiente del principal.

JS runtime: `5fcc1a2a434a577e84a9527adbfcd3790016ee19dc532643c1215ebeb5d46c42`.
CSS runtime: `72bb8ce85991aa86dfc76c04b2cb508ae9d4539116b6359823fecd081f6de544`.
Reiniciar el Hub en desarrollo carga la nueva skill. No se publicó instalador.
