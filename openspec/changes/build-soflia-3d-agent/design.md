# Diseño

DEC-AV-11 (vigente): el usuario pide más volumen y fluidez en las bandas, conservando
la silueta A y revisando siete vistas antes de animar. La nueva V3 sustituye el
microrelieve por secciones convexas anchas de altura variable, integradas en la
misma piel. Los recorridos turquesa y marino permanecen abiertos, con raíces curvas
y sin puntas. El desplazamiento frontal del contorno se limita para conservar A;
el crecimiento de profundidad se mide aparte. Se preserva V2 como comparación.

DEC-AV-10 (vigente): tras revisar la base A, el usuario autoriza continuar los
acabados para aproximarse al concepto marino/turquesa adjunto. Se conserva la
silueta A; se desarrollan materiales satinados, visor profundo, ojos luminosos,
flujos con relieve suave integrados en la misma malla y logo del archivo original.
Se entregan escena nueva, render de presentación y siete vistas sin resplandor.
Interfaz, controles y animaciones permanecen fuera del alcance.

DEC-AV-09 (base formal vigente; restricción de acabados reemplazada por DEC-AV-10): el usuario seleccionó explícitamente «A — Núcleo horizontal»
de las tres propuestas grises. Esa lámina sustituye los modelos V2–V5 como referencia
formal de esta fase. Se crea una escena nueva, de un solo cuerpo continuo con el
visor integrado como región de superficie y ojos discretos, sin casco ni bandas
independientes. Se mantienen detenidos materiales de marca, detalle, animaciones e
integración mientras se revisa la primera traducción tridimensional de A.

DEC-AV-08 (histórica, reemplazada en esta fase por DEC-AV-09): la quinta revisión rechaza el toro como topología visual de las bandas.
Se usarán láminas volumétricas de recorrido abierto, cerradas como sólidos, con
anchura, sección y grosor variables y extremos integrados en el alojamiento.
La carcasa superior y la posterior compartirán un campo superficial suave, sin
interpolar contornos hacia un polo ni suavizar pliegues creados por esa interpolación.
Esta revisión sólo cambia geometría, materiales y evidencia: interfaz, animaciones
y controles quedan protegidos mediante hashes.

Estado: revisión crítica. Las dos primeras aproximaciones fueron rechazadas por el
usuario. No continuar animaciones/exportaciones de producción antes de corregir la
base y comprobar una comparación visual explícita.

DEC-AV-06: sustituir volúmenes genéricos por superficies cerradas derivadas de los
contornos de la imagen, con bordes y profundidades definidos por componente. La
profundidad posterior se identifica como inferida, no como dato de la referencia.

DEC-AV-07 (histórica, reemplazada por DEC-AV-08): la cuarta revisión usó una jaula corporal de secciones
completas, cúpula de contorno inferior cerrado y bandas de recorrido 3D de 360 grados.
La reconstrucción por contornos frontales se limita al visor y superficies auxiliares;
no determina una tapa posterior plana. Las siete cámaras son obligatorias para la base.

DEC-AV-01: módulo autónomo `soflia-ai-agent/`, con adaptador React optativo. No montar
el avatar en una pantalla existente sin una necesidad indicada por el usuario.

DEC-AV-02: geometría PBR y animación TRS sobre objetos independientes; bandas con
deformación de escala/inclinación discreta. Curvas convertidas a mallas antes de GLB.
Evitar shaders dependientes de Blender y luces exportadas.

DEC-AV-03: clips agrupados por pistas NLA con nombres STATE_*. RIG_CONTROLLER recibe
movimientos adicionales del visor, sin sobreescribir los canales de los clips.
Las expresiones usan grupos independientes de los ojos y símbolos diferenciados.

DEC-AV-04: el logo procede del alfa y de las dos regiones cromáticas del PNG original.
Vectorización por contorno de píxeles, no reconstrucción aproximada de nodos.

DEC-AV-05: caché de promesas de carga; cada instancia clona materiales y comparte
geometría. Desmontar libera recursos privados; vaciar caché libera geometría compartida.

LIM-AV-01: objetivos de FPS no son garantías; medir visor local y declarar GPU/contexto.
LIM-AV-02: GIF tiene transparencia binaria; WebM VP9 alfa requiere verificar decodificación.
LIM-AV-03: fidelidad visual se evalúa contra referencias, sin presentarla como aprobación final.
