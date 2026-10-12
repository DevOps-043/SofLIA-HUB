# Presentaciones y producción audiovisual

Estado: implementación inicial local. Fecha: 11 de octubre de 2026.

La skill `sistema:presentaciones` conserva el manifiesto deck.json y añade tablas y diagramas. La skill `sistema:audiovisual`, invocada con `/video` en el chat de escritorio, produce motion graphics conceptuales desde film.json. Son capacidades runtime; la [skill de desarrollo](../../ai-specs/skills/audiovisual-production/SKILL.md) gobierna cambios de código y no se ofrece al agente del producto.

## Presentaciones

El [contrato](../../src/shared/presentations/deck-schema.ts) valida tablas rectangulares con hasta cinco columnas y seis filas; rechaza densidad excesiva. Los diagramas tienen dos a seis nodos y conexiones existentes. Las métricas pueden declarar conteo numérico explícito con prefijo, sufijo y decimales; el player respeta movimiento reducido y termina en el valor textual original. El [player](../../src/presentation-runtime/PresentationPlayerApp.tsx) usa tabla accesible y trazos SVG animados.

El [exportador común](../../electron/presentation-export/pptx.ts) sirve a equipos en segundo plano, create_document y el botón PPTX del panel. PPTX es un ZIP Office real con texto, tablas, conectores y gráficas editables. Las entradas antiguas conservan su contenido mediante adaptación y paginación, con un máximo explícito de 120 diapositivas de salida y las cuotas de bytes existentes. Los prompts de imágenes antiguos quedan en notas; PPTX no sintetiza imágenes. En decks con imágenes y datos, el visual se coloca en una diapositiva adicional para evitar superposición. Una ruta sin resolver de recursos rechaza imágenes declaradas en lugar de omitirlas.

`create_document` con `pptx`, `powerpoint` o `presentacion` produce .pptx. `presentacion_pdf` conserva la exportación PDF explícita. El workflow declarativo de WhatsApp selecciona el exportador de deck.json. HTML usa el [IIFE independiente](../../vite.presentation.config.mts), incorpora recursos y abre sin servidor ni red. Ejecutar `npm run presentation:build` antes de exportar en desarrollo; `build:app` lo incluye.

## Audiovisual

El [manifiesto](../../src/shared/audiovisual/film-schema.ts) admite 6–60 segundos, 30/60 fps, 1280/1920 de ancho y aspecto 16:9. Escenas contiguas y objetos con identificadores estables determinan continuidad e interpolación. El cierre reserva tres segundos completos tras su transición. Hasta tres objetos amplios por escena evitan cajas ilegibles.

La [función de fotograma](../../src/shared/audiovisual/frame.ts) genera SVG sin red ni código aportado por el modelo. Sharp rasteriza y [main](../../electron/audiovisual/service.ts) envía PNG a FFmpeg por pipe con backpressure. Los frames estáticos comparten la rasterización; se codifica cada frame con su timestamp. La música es PCM estéreo determinista a 48 kHz, normalizada y codificada a AAC. La opción silencio mantiene una pista silenciosa.

Solo se publica tras comprobar H.264/AAC, dimensiones, frecuencia de audio, canales, duración, todos los frames, PTS finitos y decodificación completa. Para síntesis se mide el AAC final: −14 ±1 LUFS y pico ≤−1 dBTP. El QA vincula hashes del manifiesto y del MP4; editar las escenas invalida ready. El modelo no escribe QA, vista ni MP4. Cancelar mata el proceso y limpia temporales; una publicación interrumpida restaura la anterior. Reiniciar no reanuda un render en curso: se conserva el manifiesto y puede producirse de nuevo.

Una producción simultánea; doce minutos; archivo MP4 hasta 80 MB; workspace audiovisual hasta 128 MB; manifiestos hasta 512 KB. La vista previa anterior al render comparte SVG y es muda; después reproduce el MP4. El panel ofrece producir, cancelar, ver archivos y abrir carpeta. La herramienta del chat recibe el identificador de su contexto, nunca uno elegido por el modelo. WhatsApp y Telegram no reciben render audiovisual.

## Entorno y preparación

La [plantilla](../../.env.audiovisual.example) contiene únicamente estas variables:

| Variable | Uso | Valor por omisión |
| --- | --- | --- |
| `VITE_SKILL_AUDIOVISUAL_ENABLED` | Bandera pública de la skill, leída por Vite | false; setup local la activa |
| `SOFLIA_FFMPEG_PATH` | Ruta absoluta al encoder, solo main | media-runtime/ffmpeg del proyecto o resources |
| `SOFLIA_FFPROBE_PATH` | Ruta absoluta al inspector, solo main | media-runtime/ffprobe del proyecto o resources |

Ejecutar `npm run audiovisual:setup -- <ruta-absoluta-ffmpeg> <ruta-absoluta-ffprobe>`. El [script](../../scripts/setup-media-runtime.mjs) comprueba ejecutables y codecs, copia binarios y DLL, registra hashes y crea `.env.audiovisual.local` con rutas del equipo. Conserva ese archivo si ya existe. No lee ni modifica el `.env` existente. No hacen falta secretos nuevos ni claves de API para render y música. La planificación usa el proveedor ya configurado en el producto.

Vite carga la bandera pública del archivo audiovisual; main carga sus rutas en ejecución sin exponerlas al renderer ni incrustarlas en el bundle. Reiniciar `npm run dev` después de configurar. Cambiar `VITE_SKILL_AUDIOVISUAL_ENABLED=false` retira la skill del catálogo; conserva los archivos.

También se pueden declarar estas tres variables en el `.env` principal local.
Ese archivo tiene prioridad sobre el respaldo audiovisual separado. Las rutas
deben ser absolutas, entre comillas si contienen espacios, y apuntar a ejecutables
verificados; no son argumentos del modelo. La reconciliación del 12 de octubre
añadió esa configuración al equipo por solicitud explícita del usuario, sin
cambiar credenciales ni versionar los archivos locales. La preparación automática
continúa creando únicamente `.env.audiovisual.local`.

Los binarios locales usados para la prueba proceden de un proveedor enlazado por la [página oficial de FFmpeg](https://ffmpeg.org/download.html). La preparación local no acredita distribución en instaladores: antes de publicar se debe incorporar el motor de cada plataforma y sus obligaciones de licencia. Esta entrega no cambia el empaquetado multimedia ni publica una release. La bandera de release queda apagada por omisión hasta distribuir ese runtime; setup activa la capacidad local.

## Verificación y límites

`npm run production:smoke` produce presentación HTML/PPTX y MP4 real usando los [fixtures](../../test/fixtures/audiovisual-film.json). Los resultados se guardan en production-smoke, ignorado por Git. `node scripts/run-production-smoke.mjs --preview-only` comprueba reproducción y seek del MP4 a través del protocolo real de Electron. `node scripts/quality/verify-production-html.mjs` comprueba el HTML sin red y guarda capturas. Las pruebas de [contratos](../../electron/__tests__/production-contracts.test.ts) cubren determinismo, código prohibido, escenas inválidas, exportación binaria, campos heredados, exclusión de renders, metadatos ausentes y protección del informe.

Esta versión tiene dirección visual conceptual y un repertorio limitado de documentos, tableros, lecciones y marca esquemática. No importa fotografías, voz, 3D ni activos oficiales de marca. No demuestra paridad estética con Claude, sincronía perceptiva de impactos musicales ni portabilidad de fuentes entre plataformas. El QA técnico no reemplaza revisión visual/auditiva. La réplica cinematográfica, composición musical por eventos, fuentes portables y empaquetado multiplataforma permanecen en el [plan de evolución](../plans/presentaciones-y-skill-audiovisual-2026-10-11.md).
