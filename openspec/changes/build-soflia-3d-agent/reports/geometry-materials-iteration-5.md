# Revisión 5: geometría y materiales

Estado: entrega de geometría para revisión visual. Fecha: 2026-11-11.

## Problema y corrección

El turnaround anterior mostraba pliegues laterales de la carcasa y bandas con lectura
de aros rígidos separados del alojamiento. Los cierres de malla de aquella versión
eran correctos, pero no garantizaban continuidad visual ni correspondencia con el concepto.

Se retiró la construcción radial de la cubierta y el generador de aros. La carcasa,
su parte posterior y los labios del visor se obtienen ahora del mismo campo superficial
suave, con desplazamientos normales y bordes cerrados. El volumen interior tiene un
alojamiento frontal rebajado para no atravesar el visor; su zona inferior recupera
profundidad para sostener la banda desde los laterales.

Las bandas son dos láminas sólidas de recorrido abierto y sección elíptica variable.
La turquesa nace dentro de la lámina marina y sigue por el frente inferior, lateral
derecho y dorso superior, donde se integra en la carcasa. No se oculta una tapa cortada
girando la cámara: tanto los centros como los perímetros de sus extremos se comprueban
desde las siete posiciones. Se retiró una pieza lateral que quedaba como aleta.

El dorso es continuación de las superficies frontales, con una junta orgánica y la
prolongación longitudinal de la banda. No hay un aro posterior superpuesto. La vista
posterior sigue siendo una interpretación de una única referencia frontal.

## Materiales y comparación

Marino: metalicidad 0,32 y rugosidad 0,36. Turquesa: metalicidad 0,10, rugosidad 0,26,
emisión 0,12, transmisión 0,28 e IOR 1,35. La geometría tiene espesor variable real;
la transmisión no sustituye un volumen por un plano. Eevee usa trazado en pantalla
y 128 muestras; no se aplica bloom en los renders Blender.

Las siete cámaras, escala ortográfica 2,75, objetivo Z -0,093, luces, exposición y
gestión AgX se conservan para comparar con la versión anterior. Se producen además
dos vistas laterales en arcilla neutra, sin emisión, transmisión ni metalicidad.
La comparación V4/V5 de laterales utiliza los renders de la copia previa, sin recortar
la silueta ni añadir elementos al concepto.

## Verificaciones reales

- Maestro editable y versión convertida reabiertos y evaluados con Blender 5.3.
- Mallas cerradas, volúmenes positivos y ausencia de coordenadas no finitas.
- Las bandas tienen Euler 2: son sólidos con extremos, no toros de Euler 0.
- Ancho y grosor medidos sobre la propia malla: sus máximos superan cuatro veces
  sus mínimos; la variación no se limita a un parámetro que no afecte a la geometría.
- Continuidad de cubierta: percentil 99 del cambio entre normales exteriores de
  aproximadamente 4,66 grados. Se revisan también las vistas de arcilla.
- Cero autopenetraciones detectadas en cubierta y bandas mediante BVH y pruebas de
  arista contra triángulo no adyacente.
- Los contactos entre bandas sólo se permiten dentro del anclaje definido. No se
  presenta esta unión como ausencia absoluta de contacto entre todas las piezas.
- Ojos y visor comprobados con rayos desde frente y ambos tres cuartos; todos los
  puntos ópticos muestreados de los ojos quedan despejados de bandas y carcasa.
- Extremos y perímetros de ambas bandas ocultos por sus alojamientos en las siete
  cámaras, en lugar de tapas expuestas al espectador.
- GLB estático abierto con GLTFLoader, pruebas Node aprobadas y siete cámaras en Three.js.
- `npm run verify:pr`: aprobado, 5 975 pruebas existentes y cinco omitidas.

El detalle vigente vive en `soflia-ai-agent/build/geometry-validation.json`,
`visibility-validation.json`, `self-intersection-validation.json` y los registros `v5-*`.
Las imágenes versionadas son `seven-view-comparison-v5.png`, `lateral-comparison-v5.png`
y las dos vistas `clay-side-*-v5.png` bajo `previews/reconstruction/`.

## Logo y alcance protegido

El PNG de referencia coincide por SHA-256 con el archivo original proporcionado:
`57B2A9B18B84080C3A22E91C192BFEDA0157E0E60C40594F175EA69EC9A547BE`.
La malla procede de sus contornos vectorizados de alfa y dos regiones de color,
no de círculos y conexiones reinterpretados. La comparación raster/SVG obtiene
IoU de silueta 0,9961; no se usa esa cifra como prueba de fidelidad del avatar completo.

Once archivos de interfaz, integración, animaciones y controles se comparan con
su hash previo. No hay modificaciones en ellos. No se han creado estados nuevos,
reducido geometría, cambiado permisos, añadido IPC ni modificado configuraciones globales.

La copia V4 queda en `build/before-v5/`; los archivos vigentes se identifican como V5.
La aprobación estética sigue correspondiendo al propietario de la identidad. Las
pruebas estructurales no afirman reconstrucción idéntica ni reconstruyen una vista
posterior que no se ha proporcionado.
