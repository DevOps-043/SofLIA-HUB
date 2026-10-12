# Diseño

Las tarjetas reutilizan un icono por familia de archivo y muestran nombre,
formato y tamaño, sin autores técnicos. El panel lateral agrupa archivos por
encargo, con estado global y controles de recuperación. La síntesis aparece
en el chat; los registros internos siguen disponibles al runtime.

El visor tiene una cabecera adaptable con acciones accesibles y pestañas con
iconos. Desaparecen pies informativos permanentes. Un hook compartido por visor
y panel lateral acota el ancho al espacio disponible, captura el puntero,
admite flechas y recuerda la preferencia local. El contenido no se remonta al
redimensionar. Las ventanas estrechas conservan una distribución adaptable.

La revisión visual posterior compacta cabecera y pestañas, y cambia los iconos
de archivos a trazos monolineales pequeños. El indicador de ajuste se extrae
del sidebar a `PanelResizeGrip`: los tres paneles comparten exactamente barra
de 4 px, alturas 32/64/96 px, colores de hover y brillo de arrastre. No se
mantienen variantes CSS duplicadas de ese indicador.

La política de equipos mantiene una única normalización de instrucciones del
usuario, excluyendo citas y bloques de código. La política ejecutora añade
criterios explícitos de complejidad y capacidad; no interpreta documentos
adjuntos ni historial como órdenes de delegación o permisos nuevos.
