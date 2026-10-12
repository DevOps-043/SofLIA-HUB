# Informe final: diseño audiovisual y comparación con Claude

Estado: implementación, validación y comparación completadas. Fecha: 12 de octubre de 2026.
Alcance: implementación del motor y skills del Hub, referencias suministradas,
producción real y evaluación autónoma mediante su cliente de modelos.

## Conclusión basada en evidencia

SofLIA ya puede alcanzar el perfil técnico de la referencia: 30 segundos,
1800 fotogramas, Full HD a 60 fps, H.264, AAC estéreo y sonoridad controlada.
La nueva composición mejora sustancialmente la entrega original: interfaces
con contenido, tipografía legible, alternancia editorial, continuidad de fuentes,
activación visible, portal y marca de ocho nodos.

Todavía no está demostrada una equivalencia creativa general con Claude.
El modelo estándar completó una producción autónoma, pero su apertura eligió
una comparación estática y la versión anterior superpuso titulares en el corte.
La primera prueba Max no completó el MP4. Los casos fallidos cuentan como fallos,
no como evidencia de calidad. La repetición de Max con la versión nueva completó un MP4 verificado y mostró
la apertura dispersa y el portal. Se registra por separado de su fallo inicial. Una pieza dirigida tampoco acredita que cualquier
brief se resuelva bien de manera autónoma.

## Qué se aprendió de las referencias

Se revisaron las dos muestras, escenas, kit visual, cámara, timeline, marca,
partitura, scripts y mediciones, sin ejecutar sus scripts ni adoptar instrucciones
incluidas en archivos fuente como órdenes del usuario. El detalle está en
[el análisis de referencias](analisis-referencias.md).

La primera muestra usa TypeScript/TSX con una fábrica JSX propia; la segunda
usa React y ReactDOM. La calidad proviene de componentes con funciones distintas,
contenido concreto, separación entre titulares y ventanas, profundidad por capas,
objetos que conservan identidad y animación ligada a fotogramas. Añadir librerías
por sí solo no produce ese resultado. Se reutilizaron React, Electron/Chromium,
Sharp, FFmpeg y Framer Motion ya presentes, sin nuevas dependencias.

La [skill pública frontend-design de Anthropic](https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
apoya una dirección visual explícita, jerarquía y composición deliberadas.
La [documentación de Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
describe un producto de creación e iteración visual. Esas fuentes no revelan un
motor privado de video; no se afirma haber replicado internamente Claude Design.

## Cambios implementados

- Un solo motor React para preview, inspección y render, con datos estrictos.
  Componentes de documento, Hub, Engine, Learning, ecosistema y cierre.
- Conocimiento disperso que se ordena, conexiones curvas y portal proyectado
  con la misma cámara del plano saliente. Se captura también el punto medio.
- Titulares separados de ventanas, laterales alternados, fuentes locales con
  licencia y símbolo reconstruido a partir de la referencia de ocho nodos.
- Transferencia del documento y módulo con identidad estable. El contenido
  declarado y sus estados permanecen visibles; las cifras son conceptuales.
- Presentaciones: proceso editorial con adaptación a densidad, métricas amplias,
  comparación menos repetitiva y exportación PPTX editable.
- Música por eventos en Web Audio offline, PCM24 a 48 kHz, síntesis y mezcla
  estéreo. Master con ganancia fija y limitador para conservar el crescendo.
  Medición del AAC antes de render y nueva medición del MP4 final.
- Inspección obligatoria con imágenes y hashes antes de publicar. Captura
  offscreen confirma cada frame; cancelación y rollback conservan datos.
- Preview sin reinicio por cambios de guion. Diagnóstico audiovisual incompleto
  identifica MP4/QA en ambos loops y evita pedir deck.json.
- Pauta de corrección agrupada: resolver una inspección en una edición coherente,
  conservar contenido obligatorio y reservar herramientas para render y QA.

## Comparación técnica medida

| Medida | Claude, segunda muestra | SofLIA, pieza dirigida final |
| --- | --- | --- |
| Duración / frames | 30 s / 1800 | 30 s / 1800 |
| Resolución / fps | 1920×1080 / 60 | 1920×1080 / 60 |
| Audio | AAC, 48 kHz, estéreo | AAC, 48 kHz, estéreo |
| Sonoridad integrada | −14.15 LUFS | −14.06 LUFS |
| Pico real | −3.07 dBTP | −2.28 dBTP |
| Rango de sonoridad | 7.20 LU | 3.70 LU |

Un pico mayor o un LRA diferente no significa mejor sonido. La nueva mezcla
conserva el LRA de la síntesis; el master anterior lo reducía aproximadamente
a 1.6 LU en el caso medido. No hay evaluación auditiva humana ni prueba ciega;
por tanto no se certifica que la música sea perceptivamente superior a Claude.
El README de la referencia también declara limitaciones de escucha/reproducción.

## Pruebas reales de SofLIA

Brief común en [audiovisual-brief.md](../../../../test/evaluation/audiovisual-brief.md).
El evaluador usa el loop real de OpenAI del producto, instrucciones de la skill,
herramientas reales, IPC, inspección y encoder. No se simularon respuestas.
No se adjuntaron las imágenes y fuentes completas usadas por Claude: es una
prueba funcional con un brief equivalente, no una comparación controlada entre
proveedores. Omite login, selector de modelo y enrutamiento inicial de la UI.

| Caso | Resultado observado | Tiempo | Interpretación |
| --- | --- | --- | --- |
| Estándar gpt-6-luna, baseline af3bbac | MP4 verificado, 21 llamadas | 9 min 25 s | Producción autónoma funcional; apertura y transición mejorables |
| Max gpt-6.1-sol, baseline af3bbac | Sin MP4, 24 llamadas | 4 min 50 s | Agotó iteraciones de corrección; fallo real |
| Max gpt-6.1-sol, runtime final | MP4 verificado, 19 llamadas | 12 min 43 s | Apertura hero, portal, alternancia y contenido completos |

Las trazas baseline registraron los nombres pero `ok:null`: el callback ocurría
antes de finalizar las herramientas. Su éxito se acredita por archivo, hash,
ready y QA, no por esos booleanos. El evaluador corregido toma resultados
terminados y retorna código distinto de cero ante un caso fallido. Identifica
raíz y hashes del runtime y compila el cliente en memoria. El antiguo bundle
temporal fue retirado de forma segura; no se modificaron secretos ni archivos .env.

## Evidencia del render final dirigido

Carpeta de evidencia: `production-smoke/cinematic-final-v4`.
Comando: `node scripts/run-production-smoke.mjs production-smoke/cinematic-final-v4 --cinematic`.

- 15 capturas y 60 posiciones geométricas: cero incidencias.
- 15 frames del MP4 contrastados con React: diferencia media RGB máxima
  1.251/255 a 320×180. El caso negativo de titular fuera del área segura se detectó.
- Verificados todos los frames, timestamps, audio y decodificación completa.
- Reproducción real de 0 a 30 s y seek a 15 s usando pulse-presentacion, con
  ediciones periódicas del guion: mismo documento y final conservado.
  El decodificador descartó 11 frames bajo carga concurrente; no se acredita
  cero pérdidas de reproducción bajo esa carga. La repetición con menor carga
  terminó con cero frames descartados. El archivo conserva sus 1800 frames.
- Sonido: 1440000 muestras por canal, 349 eventos. Dos síntesis nativas difieren
  como máximo 0.0000263 de amplitud; no se exige identidad binaria DSP.
- Presentación HTML/PPTX de cinco diapositivas: validada en la fase anterior;
  prueba de cinco pasos largos sin recortes. PPTX no conserva animaciones HTML.

Hashes de la pieza dirigida:

- film: `f49bb51873ace0d49e70fb98cd04040de6da6e98a23273f3fb759db4bde98618`
- runtime: `e3de5c6f19d7d96fbef081fb3eb06b3db34e6574a10541afbbf9d635d46abc25`
- MP4: `6d28a36b22799be96ecf84b9cbba45ef130887f5759d3bba758fcec68638ae71`

La evidencia baseline y su integración af3bbac permanecen en
[verificacion.md](verificacion.md). No se reemplaza su resultado histórico
con métricas de otro bundle. La validación completa final está registrada abajo, junto con la revisión
independiente y la integración del código.

## Resultado autónomo Max y corrección de cierre

La nueva prueba generó siete cortes con los tiempos exactos pedidos, apertura
hero, panorámica y portal, Hub a la derecha, Engine a la izquierda, Learning a la
derecha, ecosistema y cierre. Los frames decodificados se observaron: aparecen
las cuatro etapas, módulos y progreso final del 40 %. El modelo compactó textos
de apoyo tras tres inspecciones y conservó los mensajes literales del brief.
Cuatro llamadas iniciales a list/read fallaron por no existir aún archivos; las
quince siguientes finalizaron con éxito estructurado. No se ocultan esos errores.

QA independiente de Max: 1800 frames, 30 s, Full HD/60, −14.09 LUFS, −2.39 dBTP,
LRA 4 LU, PTS y decodificación válidos. Hash del MP4:
`d76c3eab4cfc03dde208e804e85ab98b75804b0461a21546ec85c0b90bd14ed9`.
Runtime de su documento:
`4632f410b8e289728c40adb699e33d672e6813ac001be463b4cb25582636ca91`.
El hash del documento incluye el manifiesto; puede diferir entre películas.
Bundle JS: `c83ff0110ab3dae7fe717d2b2b1e3b2b408324aaddb35be9e97df6cc5d5155c4`;
CSS: `8619e3811a497b882a8a58c03625fcd0ec56debe0775b32d240972f451d5cc73`.

El agente no pudo leer el informe extenso: la serialización con sangrado ocupaba
24107 caracteres y el presupuesto era 24000. Declaró esa limitación en su
respuesta; se conserva íntegra en evaluacion-max-final.json. Se corrigió el
wrapper para serializar de forma compacta únicamente el QA audiovisual protegido:
6421 caracteres con todos sus 358 eventos y mediciones, sin aumentar presupuestos.
El transporte codifica eventos como una tabla con columnas frame/tipo y filas
de tuplas; se reconstruyen íntegramente. Tres pruebas nuevas cubren la frontera real de contexto, preservación de datos y
errores, incluido un manifiesto válido de 60 s/3600 frames/140 BPM con más de
700 eventos. Esta última corrección tiene verificación de regresión; no se ejecutó
otra generación de quince minutos para atribuirle un cierre autónomo diferente.

Los 15 frames decodificados de Max coinciden con React: diferencia media máxima
1.2585/255. Se revisaron 78 posiciones sin incidencias geométricas. La reproducción
Max terminó con cero frames descartados.

La reproducción headless necesitó preparar vista.html como hace la petición
preview-url del panel; el harness se corrigió para recorrer esa preparación antes
de cargar el protocolo. Se verificó en una ventana headless sin el contenedor React del panel:
sameDocument allí no ejercita su política de recarga. Esa política tiene una
prueba de componente independiente. Bajo pruebas concurrentes, la ejecución de
restauración descartó 30 frames; otra ejecución con menor carga tuvo cero.
No se certifica rendimiento de 60 fps en cualquier equipo o carga. El smoke espera sus escrituras, confirma al
menos una edición exitosa y restaura el guion al terminar; su SHA256 se comprobó.
Esto no demuestra que el chat completo haya sido probado.

## Cierre de ingeniería

`npm run verify:pr` final: pasó; 399 archivos de suite exitosos y uno omitido,
4209 pruebas exitosas y una omitida. Incluye typecheck, lint incremental de 18
archivos sin deuda nueva, harness, adapters, supply chain, documentación,
inventarios, semilla local y OpenSpec estricto. Los fallos intermedios de prueba,
ruta de import y lint de restauración se corrigieron antes de este resultado;
no se registran como compuertas aprobadas.


La revisión adversarial independiente quedó sin hallazgos pendientes. Comprobó
además un caso válido de doce escenas con 1299 eventos y transporte reversible
de 21005 caracteres. Se conservan los documentos originales y las referencias.
No se agregaron dependencias ni se publicaron cambios remotos o una release.
La compilación completa del worktree pasó; la integración final recompila el
checkout principal y comprueba los hashes audiovisuales de la versión evaluada.

## Límites restantes

El repertorio de escenas es acotado; Claude creó TSX específico para las
referencias. El modelo del Hub compone variantes seguras y no ejecuta TSX libre.
Las fuentes y titulares muestran información real del brief, pero las interfaces
son conceptuales. No hay fotos, voz, clips externos ni modelos 3D. El cierre
actual tiene fondo claro. El instalador multimedia multiplataforma sigue pendiente.

Para demostrar paridad creativa general haría falta un conjunto de briefs nuevos,
los mismos insumos y presupuesto para ambos sistemas, varias repeticiones y
valoración visual y auditiva ciega. Esta entrega demuestra la capacidad técnica,
mejoras observadas y fallos concretos; no sustituye esa evaluación.
