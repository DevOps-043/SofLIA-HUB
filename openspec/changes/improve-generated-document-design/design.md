# Decisiones

Un modelo de bloques Markdown compartido alimenta Word y HTML imprimible;
conserva listas, tablas con celdas vacías, enlaces seguros y texto literal.
La apariencia se resuelve una vez: estilos editorial, formal y compacto;
fuentes permitidas y acento hexadecimal opcional. Las preferencias son datos,
no CSS, HTML o instrucciones ejecutables.

Word define estilos semánticos reutilizables, tamaño Carta y títulos negros.
Los documentos breves comienzan con título y metadatos en la misma página;
los informes extensos pueden usar portada. Las solicitudes explícitas de
portada conservan prioridad. Los encabezados quedan con su contenido; las
tablas repiten cabecera, envuelven texto y dimensionan columnas por contenido.

PDF escapa entradas, utiliza los mismos bloques y tipografía y conserva el
aislamiento y ciclo de vida de su ventana oculta. La vista Word sigue siendo
de lectura, sin ejecutar scripts ni intentar reproducir toda la paginación.
Su título, subtítulo y metadatos tienen tratamientos específicos.

Validar con archivos OOXML reales, regresiones del generador y artefactos,
PDF/HTML y ejemplos breves y largos renderizados. Guardar evidencias del
render en el reporte, sin publicar documentos de prueba como entregables.
