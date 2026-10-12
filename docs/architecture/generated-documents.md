# Diseño de documentos generados

Estado: vigente. Implementación en `electron/document-designer/`.

<!-- evidence: electron/document-designer/create-document.ts -->
<!-- evidence: electron/document-designer/html-document.ts -->
<!-- evidence: src/shared/document-design.ts -->
<!-- evidence: electron/background-teams/artifacts.ts -->

Word y PDF comparten un modelo de bloques Markdown y un diseño editorial
predeterminado. Se conservan encabezados, énfasis, listas anidadas, tablas,
enlaces HTTP(S)/mailto y código literal. El documento Word usa estilos
semánticos editables, formato Carta, cuerpo de 11 puntos y títulos negros.
El título, el subtítulo opcional y la fecha de generación preceden al contenido.
Se elimina únicamente un primer encabezado idéntico al título, para evitar
repetirlo; no se reescribe el texto del encargo.

La portada automática se reserva a contenidos de al menos 6.000 caracteres.
`includeCover` explícito tiene prioridad. El encabezado discreto y el pie con
paginación se omiten en una portada de Word. Las listas breves permanecen juntas;
los encabezados se mantienen con el párrafo siguiente. Las gráficas anexas
conservan su proporción y se acotan al área útil de la página.

Las tablas conservan celdas vacías y barras escapadas, dimensionan columnas
según contenido, respetan alineación Markdown y centran valores cortos cuando
no existe alineación explícita. Usan bordes gris claro, relleno alternado,
padding y encabezado repetido; no imponen altura fija a filas. Admiten hasta
20 columnas. Word permite dividir filas extensas en vez de recortar su texto.

## Personalización desde herramientas o skills

`create_word_document` y `create_document` admiten `design`:

```json
{"preset":"formal","fontFamily":"Georgia","accentColor":"243746"}
```

Los presets son `editorial` (predeterminado), `formal` y `compact`. Las fuentes
admitidas son Calibri, Arial y Georgia. El acento es un hexadecimal de seis
dígitos sin `#`; el texto del encabezado de tabla se elige negro/blanco según
contraste. No se aceptan CSS, recursos externos, claves desconocidas ni código.
El estilo formal usa Georgia si no se indica fuente; el compacto reduce
espaciado y título, conservando cuerpo de 11 puntos. Los ajustes explícitos del
usuario o su skill deben suministrarse mediante estos campos; la herramienta
no crea ni modifica skills ni sustituye una plantilla externa existente.

Las herramientas principales usan `include_cover`, `subtitle` y `author`.
`write_artifact` de equipos usa `includeCover`, `subtitle`, `author` y `design`
cuando genera DOCX. Sus esquemas validan ajustes antes de publicar archivos y
los incorporan al hash de entrada; los controles de identidad y artefactos no
cambian. Debe usarse estructura Markdown en el contenido, evitando dibujos
de líneas con caracteres y títulos duplicados.

## Lectura y PDF

La vista de Word reconoce estilos Title, Subtitle y SofLIA Metadata. Usa una
hoja de lectura coherente con el diseño, bajo el aislamiento existente y sin
scripts. La vista de lectura conserva contenido y estructura; no reproduce
toda la paginación, fuentes personalizadas o formato de un DOCX externo.

PDF escapa texto y atributos, utiliza bloques compartidos y CSS propio, y se
imprime desde una ventana oculta con sandbox y Node desactivado. Deniega scripts,
red, formularios y recursos externos mediante CSP. La ventana se libera también
al fallar carga/impresión o superar 30 segundos. No se ejecutan fórmulas ni HTML
suministrado dentro del Markdown. El PDF es una salida de lectura; Word sigue
siendo editable.

Los ejemplos reproducibles viven en `test/manual/document-design/` y la
evidencia en `openspec/changes/improve-generated-document-design/reports/`.
La generación no depende de Word instalado; Word se utilizó solo para QA local.
