# Auditoría de la versión rechazada

Estado: diagnóstico confirmado el 2026-11-11; reconstrucción base en curso.

El usuario rechazó dos aproximaciones. Ninguna constituye una identidad aprobada.
La referencia conceptual tiene prioridad sobre el código y los binarios anteriores.

## Copia y alcance inspeccionado

Copia funcional local: `soflia-ai-agent/build/rejected-v2-backup/`, con Blender,
GLB, referencias, scripts, componentes, GIF/WebM y PNG. No incluye cachés de fotogramas.
La auditoría automatizada abrió la escena optimizada sin modificarla; su detalle
está en `soflia-ai-agent/build/audit-v2.json`.

Se revisaron los once módulos Blender, el controlador, visor, componente React,
materiales, NLA, maestro, optimizado y GLB. No hay texturas de imagen sobre planos:
las imágenes Blender son Render Result y Viewer Node. Sí hay esferas UV como volumen
principal y visor, curvas convertidas en tubos y bandas procedurales sobre recorridos
genéricos. Ojos y logo son mallas de superficie con espesor.

## Hallazgos confirmados

- P1 visual: la capucha se deriva de coordenadas esféricas y una deformación lateral.
  No reproduce las curvas de recorte y relaciones de volumen de la referencia.
- P1 visual: cintas construidas desde un eje central y anchura arbitraria. Esto
  produce una gota rodeada por cintas pegadas, en vez de superficies diseñadas.
- P1 materiales: marino con metalicidad 0,68 y rugosidad 0,26; turquesa 0,62/0,29 y
  emisión 0,5, ojos con emisión 4. Entorno brillante, luces fuertes y bloom añadieron
  zonas blancas. Ajustar exposición por sí solo no corrige estos materiales.
- P2 topología: bordes no manifold en extremos de curvas convertidas, bordes de
  carcasa y una isla diminuta del logo. La isla tiene volumen firmado negativo.
  No se ha demostrado ausencia global de intersecciones.
- P2 estados: seis clips existen y controles cambian transformaciones reales, pero
  expresiones basadas sobre todo en escala de ojos no satisfacen la intención visual.
  La exportación inicial eliminaba canales constantes; se corrigió y se probó.
- P2 medición: 29 238 son triángulos GLB. 29 252 incluían 14 triángulos de efectos.
  El valor 1 era el último triángulo de OutputPass por reinicio automático de info.
  Se corrigió la acumulación del contador. Medir durante render Blender concurrente
  no representa el rendimiento aislado; repetir sin cargas concurrentes.
- Logo: vectorización desde alfa original con IoU 0,9961. Eso sólo valida contorno;
  no demuestra que el relieve, orientación y legibilidad sobre la capucha sean correctos.

## Corrección exigida

Reconstruir primero superficies por contornos/control points trazados en coordenadas
de la imagen aprobada; dar espesor y curvatura reales y cerrar sus reversos. Conservar
los contornos de capucha, abertura facial y dos bordes de cada banda. Prohibido usar
el render como plano sustituto. Revisar frente, 45°, lateral y posterior, fondo claro
y oscuro, y comparación referencia/Blender/Three.js antes de recrear estados.

La vista posterior es inferida porque no existe referencia posterior aprobada.
No se afirmará reconstrucción perfecta ni aprobación estética a partir de métricas.
