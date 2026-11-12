## Decisiones
La referencia confirmada es `ProjectGlyph`: SVG de 24 unidades, trazo redondeado de 1.65, siluetas diferenciadas y rellenos de currentColor con opacidad baja. El catálogo compartido vive en ui; ProjectGlyph conserva su API como adaptador.

IconGlyph centraliza la semántica decorativa y un grupo interior para animar sin interferir con la rotación exterior de un pin o con el tamaño del SVG. CSS hereda variables desde el control más cercano y las reinicia en controles anidados. Hover y foco elevan 1 px y escalan a 1.1; active comprime a .88. El signo más gira y el envío avanza ligeramente. No hay listeners, timers ni estado React por icono.

La preferencia reduced-motion elimina transformaciones y transiciones. Disabled y aria-disabled no activan movimiento. Se mantienen los nombres accesibles en los controles.

## Alcance y límites
Chat principal y flotante mediante componentes compartidos, menú de herramientas, acciones y navegación lateral, controles de proyectos y compositor de proyecto. No se sustituyen logos de proveedores, avatares ni estados de carga.

## Riesgos y reversión
Validar herencia en controles anidados, temas claro/oscuro, foco, disabled por fieldset y movimiento reducido en Chromium. Revertir estos archivos restaura la presentación sin tocar datos ni acciones.
