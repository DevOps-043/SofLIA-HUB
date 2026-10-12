# Evidencia de implementación

Fecha: 12 de octubre de 2026. Worktree: codex/presentaciones-audiovisual, base
699e750. Sin ejecución de scripts externos, nuevas dependencias, cambios de
secretos, mutaciones remotas ni publicación de release.

## Pruebas y compilación

- `npm run verify:pr`: pasó; 397 archivos de suite, 4202 pruebas exitosas y una
  prueba omitida, tras corregir etiqueta de herramienta e inventarios derivados.
  Incluye typecheck, lint incremental sin deuda nueva, adapters, harness, supply
  chain, documentación, semilla local y OpenSpec estricto.
- `npm run build:app`: pasó; main, preload, renderer y los dos IIFE compilados.
  Continúan avisos existentes de chunks/imports dinámicos y configuración Vite.
- Pruebas dirigidas de producción, IPC, panel y player: 47 exitosas antes de
  ampliar los casos de progreso, confirmación por fila y documentos v1. Estos
  últimos casos quedaron cubiertos por la suite completa.
- Revisión independiente requerida por base.md: sin hallazgos pendientes en
  aislamiento, permisos, cancelación, exclusión, integridad, publicación y rollback.
  Corregidos progreso de filas, evento de Learning y contenido final v1.

## Artefacto audiovisual final

Comando: `node scripts/run-production-smoke.mjs production-smoke/cinematic-definitivo --cinematic`.
Salida técnica real: 1920×1080, 60 fps, 1800 frames, 30.000 s, H.264 y AAC
estéreo 48 kHz a 320 kb/s solicitado; 14571457 bytes. Sonoridad medida sobre el
MP4: −14 LUFS y −2.3 dBTP. Decodificación completa y todos los PTS comprobados.

- filmHash: `f49bb51873ace0d49e70fb98cd04040de6da6e98a23273f3fb759db4bde98618`
- runtimeHash: `c7cdbf38a9bc6fbb6d7b0c6f8830769691e9176667ec2d789353f63b27ec4762`
- videoHash: `c1a472b6f73a5888f2f6dd512517ae70db0c4d049c040635765cd094753fc957`

Inspección de 60 posiciones, incluyendo acciones, transferencias y últimos
frames: cero incidencias geométricas. Dos hojas con 14 capturas examinadas.
`verify-film-frames.mjs` compara 14 frames decodificados con React en Chromium:
diferencia media RGB máxima 1.251 niveles de 255 (reducidos a 320×180).
Caso negativo real: titular desplazado fuera del área segura detectado.
Este umbral detecta capturas equivocadas; no es una certificación perceptiva.

`--preview-only`: protocolo real pulse-presentacion, seek a 15 s, reproducción
desde 0 hasta 30 s con edición periódica de guion, mismo documento, cero frames
descartados por el decodificador. El contador de reproducción incluye el seek;
no reemplaza los 1800 frames contados por FFprobe. El panel tiene además una
regresión de identidad del iframe al recibir cambios documentales y reinicio
explícito mediante Reproducir.

`--audio-only`: 1440000 muestras por canal, PCM24, 48 kHz, dos canales, 349 eventos,
AAC −14 LUFS/−2.32 dBTP. Dos síntesis nativas difieren como máximo 0.0000268 de
amplitud; no se declara igualdad binaria. Se revisaron parámetros y mediciones,
sin afirmar una escucha humana. La producción previa al ajuste de masterización
falló la compuerta de audio y no publicó un MP4 válido; quedó corregida mediante
medición previa y conservación de la pista verificada al muxear.

## Presentaciones

`--cinematic --deck-only` y `verify-production-html.mjs`: cinco diapositivas con
portada, proceso editorial, métricas compactas, comparación y cierre. HTML abre
sin red, con cinco titulares distintos y sin errores. Métricas terminan en los
valores declarados. Caso de densidad: cinco pasos con titulares en mayúsculas y
descripciones largas; adopta recorrido horizontal, cinco pasos visibles, cero
recortes. Se produjo también PPTX real editable. El PPTX no conserva las
animaciones React del HTML.

## Comparación y límites

Segunda referencia medida independientemente: 1800 frames, 30 s, 1920×1080,
60 fps, AAC estéreo 48 kHz, −14.15 LUFS y −3.07 dBTP. Sus contactos se examinaron.
El análisis de ambas fuentes está en [el reporte](analisis-referencias.md).
Estos resultados permiten comparar perfil e implementación; no acreditan
superioridad estética ni sonora. La música y las interfaces de la entrega son
conceptuales. Instaladores multimedia multiplataforma siguen fuera del alcance.

Artefactos y reportes binarios quedan en production-smoke, ignorado por Git, y
se copian a una carpeta de entrega nueva sin sobrescribir las referencias. El
rollback de código consiste en revertir el commit de este cambio y recompilar;
los manifiestos y archivos previos del usuario se conservan.
