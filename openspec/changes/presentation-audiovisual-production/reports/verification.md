# Evidencia de implementación local

Fecha: 11 de octubre de 2026. Estado: implementado e integrado al checkout principal.

Se corrigieron las rutas de PPTX/PDF y deck.json/HTML, se compartió el exportador editable, se añadieron tablas y diagramas nativos y conteos numéricos explícitos. La nueva skill `/video` produce escenas conceptuales desde manifiesto y exporta un MP4 verificado con audio sintético local. [Contrato canónico](../../../../docs/architecture/presentation-audiovisual-production.md).

## Verificación ejecutada

- `npm run verify:pr`: compuerta completa exitosa en el checkout principal; 396 archivos de pruebas exitosos, uno omitido; 4194 pruebas exitosas y una omitida. Incluye typecheck, lint de cambios, adapters, harness, documentación, seed y OpenSpec.
- `npm run build:app`: compilación de renderer/main/preload y reproductor independiente exitosa. No se ejecutó empaquetado ni publicación de release. La bandera audiovisual de release queda apagada por omisión mientras el motor no se distribuya.
- `npm run production:smoke`: HTML y PPTX reales más MP4 de 30 s, 1800 frames, 1920×1080 a 60 fps, H.264/AAC estéreo 48 kHz; PTS comprobados y decodificación completa. AAC −14 LUFS, pico −3.07 dBTP en esta ejecución.
- `node scripts/quality/verify-production-html.mjs`: cinco diapositivas diferentes, sin errores ni solicitudes HTTP, con red deshabilitada. Capturas revisadas: portada/cierre sin gráfico de relleno, tabla, conectores en bordes y gráfica.
- `node scripts/run-production-smoke.mjs --preview-only`: MP4 reproducido en Electron mediante pulse-presentacion; salto al segundo 15 comprobado, readyState=4.
- Pruebas de regresión: código/rutas prohibidos, esquema estricto, XSS escapado, exclusión simultánea, QA con metadatos no finitos, binarios protegidos, cancelación durante publicación con restauración de bytes e informe anteriores, preview idempotente, campos heredados, paginación de 24 slides y rechazo sobre 120, payloads IPC y allowlist.

La [evidencia técnica](media-evidence.json) registra hashes y mediciones. Los artefactos y capturas locales se encuentran bajo `production-smoke/`; los logs de ejecución bajo `*-audiovisual.log`, ignorados por Git.

## Integración y entorno

Se trabajó en un worktree gestionado separado y se transfirieron cambios al checkout principal mediante combinación de tres versiones. Se preservaron las modificaciones concurrentes de marca de documentos y las banderas multimodales de release. No se confirmaron ni descartaron cambios ajenos.

Se ejecutó audiovisual:setup también en el proyecto principal: creó `.env.audiovisual.local` con VITE_SKILL_AUDIOVISUAL_ENABLED=true y rutas absolutas al FFmpeg/FFprobe locales de media-runtime. No se leyó ni modificó el .env existente, ni se generaron claves de API. La [plantilla versionada](../../../../.env.audiovisual.example) contiene únicamente campos no secretos. No se aplicó SQL remoto; skills:seed actualizó solamente el archivo SQL local.

## Revisión independiente

La revisión adversarial independiente encontró y se corrigieron: carrera de renders; pérdida de contenido legacy; imágenes omitidas/superpuestas; QA válido con NaN; densidad de cajas; cancelación durante publicación y cuota divergente del lector PPTX. La revalidación independiente cerró sin P1/P2 pendientes en el alcance revisado.

Una corrida intermedia del worktree falló por limpieza de perfil temporal del navegador en una prueba ajena; el checkout principal posteriormente pasó la compuerta completa. No se cambió ese módulo para esconder el fallo.

## Límites y reversión

La pieza sigue siendo conceptual y no acredita paridad cinematográfica con Claude. No se abrió el PPTX en Microsoft PowerPoint: se verificó OOXML/texto editable, no compatibilidad visual Office. La música no recibió evaluación auditiva subjetiva. Fuentes portables, voz, imágenes, 3D, exportación de proyecto independiente y distribución de FFmpeg en instaladores son fases posteriores del plan.

VITE_SKILL_AUDIOVISUAL_ENABLED=false retira la nueva skill conservando workspaces. El render cancelado conserva la revisión anterior publicada. Los temporales se limpian; un proceso interrumpido puede producirse de nuevo desde film.json. No se ejecutaron borrados de workspaces, migraciones remotas, mensajes externos ni despliegues.
