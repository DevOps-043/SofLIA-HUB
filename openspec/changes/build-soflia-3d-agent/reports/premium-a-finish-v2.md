# A · Acabado marino y turquesa V2

Estado: acabado estático para revisión visual. Fecha: 2026-11-11.
Autorización: continuar los acabados sobre A aproximándolos a la imagen adjunta.
Decisión: DEC-AV-10. No implica aprobación final de identidad ni de animaciones.

## Resultado y criterios

La escena `soflia-ai-agent/blender/master/soflia_a_premium_v2.blend` conserva la
estructura de A y añade marino satinado, visor oscuro, flujo turquesa integrado,
ojos cian, tres indicadores discretos y el logotipo original. No hay cintas
independientes, casco separado ni puntas nuevas. El halo de levitación pertenece
al estudio de presentación, no al personaje.

La jaula del cuerpo mantiene su conectividad; el relieve de los flujos desplaza ligeramente
su propia piel. El visor y los ojos quedan despejados porque los vértices de la
región frontal no reciben ese desplazamiento. Los ojos conservan el gesto de A,
con algo más de anchura y grosor para aproximarse al carácter de la referencia.

## Acabado y correcciones verificables

- Marino: metalicidad 0,40, rugosidad 0,34 y capa de acabado 0,24.
- Turquesa: metalicidad 0,24, rugosidad 0,28, transmisión 0,08 y borde emisivo fino.
- Visor: base casi negra, rugosidad 0,30 y reflexión especular reducida.
- La interpolación de máscaras por vértice produjo un borde festoneado en la prueba
  inicial. Se reemplazó en el material por una máscara 2K empaquetada, con UV angular
  y longitudinal. Las UV se calculan sobre posiciones previas al relieve para no
  cortar el flujo al alcanzar el lateral derecho.
- Se retiró el acento superior que parecía un pliegue en tres cuartos. El acento
  secundario se limita a una transición suave en el lateral posterior izquierdo.
- Se sustituyeron los remates cromáticos afilados y los cortes rectos por cierres
  elípticos suaves; el acento posterior tiene menor contraste.
- Se redujeron los reflejos blancos que invadían el visor. El acabado se revisa en
  las siete cámaras sin resplandor de posproducción.
- La continuidad final usa un nivel de subdivisión y un microrelieve integrado,
  limitado a 0,0051 unidades de desplazamiento de la jaula A en la validación.
  Se comprueban cierre y autopenetraciones sobre la malla evaluada, no sólo la jaula.

El logo procede de `references/logo-original.png`, con hash SHA-256
`57b2a9b18b84080c3a22e91c192bfeda0157e0e60c40594f175ea69ec9a547be`.
Sus contornos alfa generan la malla; el mismo PNG suministra los colores y gradientes,
empaquetado en Blender. La escala XZ es uniforme, sin reconstruir nodos ni conexiones.
La proyección sobre la curva sólo cambia Y; la perspectiva lateral acorta su lectura
de manera natural. La altura es discreta para caber en la zona superior de A.

## Evidencia

Generación: `blender/scripts/build_premium_a.py` y `premium_a_finish.py`.
La escena se renderiza con Cycles CPU, 96 muestras y reducción de ruido.
Las siete cámaras usan escala ortográfica 3,2 y las mismas luces. El render de
presentación cambia cámara y encuadre y añade resplandor suave; se rotula por separado.

Las imágenes están en `soflia-ai-agent/previews/premium-a-v2/`: presentación,
`turnaround-premium-a-v2.png` y `before-after-premium-a-v2.png`.
La referencia incluida es una ilustración, no una vista 3D del modelo actual.

La comprobación independiente reabre el Blender mediante
`soflia-ai-agent/tests/validate-premium-a.py`. Sus resultados viven en
`build/premium-a-v2/reopened-validation.json`: cierre, orientación, autopenetraciones,
topología y máximo desplazamiento frente a A, visibilidad ocular muestreada,
coincidencia de los puntos originales del logo y hashes protegidos.
El registro del gate de repositorio es `build/premium-a-v2/repository-checks.log`.

La validación del archivo final pasó: mallas evaluadas cerradas, volúmenes positivos,
sin autopenetraciones detectadas en cuerpo y ojos; puntos ópticos muestreados libres,
contornos originales del logo conservados y las dos texturas empaquetadas. La base
gris coincide con el ZIP anterior y los once archivos protegidos permanecen iguales.
El archivo abre en vista de materiales. `npm run verify:pr` terminó correctamente;
el resumen derivado y los hashes de entrega se incluyen con el paquete.

## Límites y revisión adversarial

La forma sigue siendo A, más ancha y baja que la ilustración adjunta. Se trasladan
color, iluminación y calidad superficial; no se recuperan las puntas y capas
independientes descartadas en la fase de siluetas. El dorso continúa siendo una
decisión de modelado sin referencia posterior aprobada.

Se revisan específicamente continuidad del flujo derecho, ausencia de una cinta
superpuesta, pliegues en el acabado superior, ojos tapados, color del logo inventado,
dependencias de imágenes externas y cambios en archivos protegidos. Los defectos
encontrados en las pruebas de material se corrigen en la misma escena antes de
entregarla. No se modifican permisos, IPC, UI, animaciones ni configuraciones globales.
La base gris y los modelos anteriores siguen preservados. La validación geométrica
no equivale a una aprobación estética ni promete equivalencia con la ilustración.
