# Iteración estructural 4

Estado: histórica; sustituida por la iteración 5 tras el rechazo de los pliegues y aros. No es una identidad aprobada.
Fecha: 2026-11-11.

## Resultado

Se sustituyó el volumen anterior por una jaula de secciones completas, con perfiles
frontal y posterior independientes. La relación profundidad/anchura del cuerpo es
0,726. La parte superior es una cúpula cerrada alrededor de la cabeza, con coronilla
redondeada, labio asimétrico controlado y espesor. La masa interior se ajustó para
evitar que atravesara la carcasa superior.

Las bandas marina y turquesa utilizan recorridos tridimensionales cerrados, sección
convexa y cantos cerrados. La turquesa conserva una superficie ancha por el lado
derecho y continúa por detrás. Se corrigieron los cruces entre bandas mediante sus
profundidades de paso. La BVH devuelve cero pares de triángulos cruzados entre las
tres superficies de bandas. Esto no constituye una prueba de ausencia de contacto
entre todas las piezas de la carcasa: existen uniones y solapes internos de montaje.

Se conservó el visor convexo y el logotipo original vectorizado. Los indicadores
se proyectan sobre la superficie marina visible para evitar quedar tapados o flotando.
La vista posterior sigue siendo una interpretación porque sólo existe referencia frontal.

## Evidencia local

El README del módulo identifica las rutas vigentes. Binarios y recursos reproducibles
permanecen excluidos de Git, disponibles en el worktree `codex/soflia-ai-agent`.

- Maestro editable y versión de modificadores convertidos, ambos reabiertos con Blender 5.3.
- GLB estático cargado con GLTFLoader, sin usar una imagen como modelo.
- Siete vistas: frontal, tres cuartos izquierdo/derecho, laterales izquierdo/derecho,
  posterior y superior. PNG transparentes y composiciones sobre claro/oscuro.
- Comparativa referencia/Blender/Three.js y lámina de referencia más siete vistas.
- `build/geometry-validation.json`: 24 mallas cerradas, cero aristas no manifold,
  cero volúmenes con orientación negativa y cero cruces BVH entre bandas.
- `build/base-browser-validation.json`: siete cámaras, render detenido en reposo,
  carga GLB real, métricas con y sin bloom y ausencia de errores JavaScript.

La base conserva aproximadamente 85 mil triángulos y 1,60 MB. No se ha optimizado,
de acuerdo con la instrucción prioritaria de resolver primero la forma. La pasada
de transmisión de Three.js dibuja el modelo otra vez; por eso el contador de trabajo
renderizado puede duplicar los triángulos del archivo. Los efectos añaden 14 triángulos
de pantalla. El contador anterior de un triángulo era sólo OutputPass, no el modelo.

La medición aislada en Chrome headless sobre Radeon RX 580 fue aproximadamente
95 FPS sin bloom y 86 FPS con bloom, a 768 × 768 y DPR 1. CPU de envío: alrededor de
1–2,2 ms; GPU mediante EXT_disjoint_timer_query_webgl2: alrededor de 4 ms.
La carga de la sesión local caliente fue aproximadamente 49 ms. Son muestras de tres
segundos, no garantías de producto, primera carga, consumo eléctrico ni memoria de Electron.
Los valores exactos y el contexto del dispositivo se conservan en el JSON de medición.

## Verificación

- Generación mediante `node soflia-ai-agent/build.mjs`: sólo base y siete renders.
- Blender con `--python-exit-code 1`, `tests/validate-base.py`: maestro y mallas convertidas.
- `node --test soflia-ai-agent/tests/base-assets.test.mjs`: dos pruebas aprobadas.
- Typecheck específico del módulo y lint incremental: aprobados.
- `npm run verify:pr`: aprobado; 525 archivos de prueba, 5 975 pruebas aprobadas y cinco omitidas.
- Inventario canónico actualizado mediante `npm run docs:inventory:sync`.

## Revisión adversarial y límites

Se intentó refutar que el modelo sólo funcionara de frente mediante siete cámaras,
profundidad corporal y pruebas sobre la malla completa. Se encontraron y corrigieron
normales inconsistentes de la cúpula, cruces entre bandas, penetración de la banda
marina en la parte superior y recursos de vista anterior que podían quedar obsoletos.

Persisten diferencias de iluminación, acabado y lectura de algunas transiciones
respecto al concepto. La validación estructural no demuestra fidelidad perfecta.
No se avanzó a animaciones, reducción de geometría ni integración definitiva.
Las exportaciones animadas de versiones rechazadas están identificadas como históricas.
La copia funcional previa y la base anterior a la corrección volumétrica se conservan.
