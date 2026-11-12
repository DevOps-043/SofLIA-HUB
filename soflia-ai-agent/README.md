# SofLIA · A — Núcleo horizontal · acabado premium V2

Estado: acabado estático de A autorizado por el usuario; sujeto a revisión visual.

## Base vigente

La escena se construye desde cero con un único cuerpo cerrado, ancho y bajo. El
visor es una región de material en esa misma malla, sin pieza de casco ni marco.
La zona inferior se prolonga en los laterales y el dorso mediante cambios suaves
de sección. No contiene aros ni bandas independientes. El turquesa recorre la zona
inferior, el lateral derecho y parte del dorso como región de la misma piel, con
relieve suave. El acento marino secundario queda en el lateral izquierdo posterior.

`selected_a_geometry.py` usa secciones controladas y un contorno frontal, no mallas
de las versiones V2–V5 ni una primitiva esférica. La anchura, altura y región del
visor se contrastan con el trazado aproximado de la lámina A. La profundidad toma
la vista lateral como orientación; el dorso es una decisión de diseño documentada.

El cuerpo tiene marino satinado y el visor un acabado oscuro con reflejos contenidos.
Los ojos son crecientes cian algo más anchos que en la base gris. Tres indicadores
estáticos recuperan un detalle de la referencia. El logo usa los contornos de alfa y
los colores del PNG original, empaquetado en la escena, sin dibujar nodos nuevos.

La máscara de material 2K usa UV angular y longitudinal. Evita las ondulaciones que
producía interpolar el color turquesa entre vértices de un loft. El turquesa combina
metalicidad 0,24, rugosidad 0,28 y transmisión 0,08, con emisión concentrada en el
borde. No sustituye la geometría por una imagen del personaje.

## Archivos

- `blender/master/soflia_a_premium_v2.blend`: escena vigente con texturas empaquetadas.
- `previews/premium-a-v2/`: siete vistas, presentación y comparación con la base gris.
- `build/premium-a-v2/finish-report.json`: materiales, cámaras y procedencia del logo.
- `build/premium-a-v2/reopened-validation.json`: validación de la escena guardada.
- `blender/master/soflia_a_nucleo_horizontal_v1.blend`: base gris conservada.
- `previews/selected-a-v1/`: siete vistas grises y comparación frontal conservadas.
- `references/selected-a-landmarks.json`: puntos aproximados sobre la propuesta A.
- `build/selected-a-v1/geometry-report.json`: geometría y contornos de la malla.
- `build/selected-a-v1/reopened-validation.json`: comprobación del archivo reabierto.
- `build/selected-a-v1/comparison-measurements.json`: proporciones comparadas.

El turnaround usa Cycles CPU, 96 muestras, proyección ortográfica, escala 3,2 y
luces constantes para las siete vistas, sin resplandor de posproducción. La
presentación usa cámara ligeramente elevada y un halo de estudio en el suelo,
independiente del personaje. Su resplandor es sutil; no se aplica a las siete vistas.

## Reproducir esta fase

Desde la raíz del worktree, con Blender 5.3 y las dependencias existentes del Hub:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background --factory-startup --python-exit-code 1 --python soflia-ai-agent/blender/scripts/build_premium_a.py
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background soflia-ai-agent/blender/master/soflia_a_premium_v2.blend --python-exit-code 1 --python soflia-ai-agent/tests/validate-premium-a.py
node soflia-ai-agent/compare-premium-a.mjs
```

Se requieren las referencias y contornos originales preservados. La validación
completa se ejecuta en este worktree: comprueba cierre, autopenetraciones, topología
y desplazamiento frente a la base A, puntos ópticos de ambos ojos, contornos del
logo y ausencia de animación. También coteja la base gris con el ZIP previo y los
once archivos protegidos de UI, integración, controles y animación con sus hashes.

## Historia y límites

Las escenas, renders y paquetes V2–V5 se conservan. El comando anterior `build.mjs`
pertenece a V5 y no genera la base A. Tampoco el comparador web previo carga esta
nueva escena: su integración está detenida por instrucción del usuario.

La referencia formal vigente es la propuesta A elegida; la imagen marino/turquesa
guía el acabado. Las siluetas son distintas y no se afirma reconstrucción idéntica
del concepto anterior. Animaciones, optimización, GIF, WebM e integración permanecen
fuera del alcance de este acabado estático.

Decisiones, diferencias y resultados: [reporte del acabado](../openspec/changes/build-soflia-3d-agent/reports/premium-a-finish-v2.md).
