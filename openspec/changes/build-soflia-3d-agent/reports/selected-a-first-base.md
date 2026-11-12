# A — Núcleo horizontal · primera base tridimensional

Estado: entrega de geometría para revisión visual, no identidad final aprobada.
Fecha: 2026-11-11. Decisión vigente: DEC-AV-09.

## Alcance

El usuario seleccionó A entre tres propuestas grises. Se construyó una escena nueva
sin importar mallas anteriores ni primitivas esféricas. Las versiones V2–V5 siguen
conservadas. No cambian interfaz, controles, animación ni integración.

La escena vigente es `soflia-ai-agent/blender/master/soflia_a_nucleo_horizontal_v1.blend`.
El generador es `soflia-ai-agent/blender/scripts/build_selected_a.py`; las curvas de
sección y la región frontal viven en `selected_a_geometry.py`.

## Restricciones y decisiones

- Cuerpo ancho, bajo, con asimetría leve; la zona inferior es más llena y achatada.
- Un único sólido cerrado de 24 322 vértices, sin cúpula separada ni tapa posterior.
- Visor oscuro integrado como región de material del cuerpo, con perímetro compartido.
- Ojos discretos de geometría propia y curvatura ajustada a la superficie frontal.
- Flujos integrados inicialmente como variación suave de sección inferior; no se
  añaden cintas independientes ni se inventa una trayectoria turquesa detallada.
- Profundidad frontal/posterior distinta para mantener un dorso completo. Se usa
  la vista lateral de A como orientación, sin asumir correspondencia métrica exacta
  entre dibujos generados. El dorso y la sección interior son decisiones nuevas.
- Muestreo concentrado cerca del cierre lateral para eliminar las pequeñas aristas
  detectadas en la primera prueba del loft. Los renders entregados son posteriores
  a esta corrección.

## Comparación y diferencias abiertas

La lámina A es la referencia formal vigente; no se presenta esta base como réplica
del concepto azul/turquesa anterior. El contorno de A se traza manualmente sobre
su frente y se alinea por anchura y centro. No se estiran ejes por separado.

Anchura/altura aproximada de la lámina: 1,562; malla medida: 1,539. El visor ocupa
aproximadamente el 79 % de la anchura y el 62 % de la altura en la lámina; la malla,
80 % y 62 %. Son proporciones de encuadre, no una puntuación de fidelidad.

Persisten diferencias visibles: la zona oscura tiene un borde de material más
definido que la transición difusa de la ilustración; el hombro derecho es algo
más lleno; la iluminación neutra tiene menos contraste de contacto. El dorso es
deliberadamente sobrio porque no existe una referencia posterior aprobada de A.
La lámina generada tampoco define el espesor técnico ni el futuro recorrido de
color. Esos límites no se ocultan con materiales luminosos.

Los archivos `previews/selected-a-v1/front-comparison-a-v1.png` y
`turnaround-a-v1.png` muestran la superposición y las siete cámaras. Proyección
ortográfica, escala 3,2 y luces constantes; únicamente se oculta el suelo en la
vista superior. No hay bloom, emisión ni transmisión.

## Verificación y revisión adversarial

Se reabrió la escena guardada en Blender 5.3. Las tres mallas del personaje tienen
Euler 2, volumen positivo, cero aristas no manifold y cero autopenetraciones
detectadas mediante BVH y pruebas arista/triángulo no adyacente. El cuerpo mide
aproximadamente 2,401 × 1,430 × 1,560. No hay actions ni datos de animación.

Se comprobaron 13 puntos de cada ojo desde frente y ambos tres cuartos: ninguno
queda oculto por el cuerpo en ese muestreo. Los once hashes de archivos de UI,
integración, controles y animación coinciden con la línea base preservada.
Evidencia: `soflia-ai-agent/build/selected-a-v1/reopened-validation.json`.

Hipótesis revisadas: reutilización de geometría rechazada, visor como tapa separada,
aros ocultos en el dorso, cierre lateral con aristas, comparativa estirada, etiquetas
que confundieran una ilustración con render real, y cambios fuera del alcance.
Se corrigieron el muestreo lateral y la documentación que seguía presentando V5 como
vigente. No se han encontrado defectos estructurales pendientes en estas pruebas;
la aceptación formal, la sección interior y el desarrollo cromático siguen abiertos.

Las compuertas del repositorio se registran por separado en
`soflia-ai-agent/build/selected-a-v1/repository-checks.log`.
