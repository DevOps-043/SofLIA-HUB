# Diseño de documentos generados

Estado: vigente. Implementación en `electron/document-designer/`.

<!-- evidence: electron/document-designer/create-document.ts -->
<!-- evidence: electron/document-designer/html-document.ts -->
<!-- evidence: src/shared/document-design.ts -->
<!-- evidence: electron/background-teams/artifacts.ts -->
<!-- evidence: electron/organization-branding/document-branding.ts -->
<!-- evidence: electron/artifact-viewer/document-theme.ts -->

Word y PDF comparten un modelo de bloques Markdown y un diseño corporativo
automático cuando hay identidad autorizada; el respaldo es editorial.
Se conservan encabezados, énfasis, listas anidadas, tablas,
enlaces HTTP(S)/mailto y código literal. El documento Word usa estilos
semánticos editables, formato Carta y cuerpo de 11 puntos. El corporativo usa
títulos y cabeceras con colores de marca; el editorial conserva títulos negros.
El título, el subtítulo opcional y la fecha de generación preceden al contenido.
Se elimina únicamente un primer encabezado idéntico al título, para evitar
repetirlo; no se reescribe el texto del encargo.

La portada automática se reserva a contenidos de al menos 6.000 caracteres.
`includeCover` explícito tiene prioridad. El encabezado discreto y el pie con
paginación se omiten en una portada editorial de Word; el corporativo conserva
logo compacto y paginación también en portada. Las listas breves permanecen juntas;
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

Los presets son `corporate` (automático con identidad), `editorial`, `formal` y `compact`. Las fuentes
explícitas admitidas son Calibri, Arial y Georgia. La fuente de marca puede usar
un nombre simple validado; la lectura ofrece respaldo Arial. `primaryColor`,
`secondaryColor` y `accentColor` son hexadecimales de seis
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

La vista de Word reconoce estilos Title, Subtitle, SofLIA Metadata y SofLIA Logo.
Reconoce el tema declarativo `SofLIA.DocumentTheme` validado con esquema estricto,
colores hexadecimales y fuente permitida. Las imágenes embebidas se normalizan,
sin SVG, metadatos ni archivos externos, con presupuesto de 64 KiB para imágenes
del contenido y hasta 64 KiB para el logo del encabezado. La vista admite hasta
ocho imágenes embebidas, reservadas antes de decodificar para acotar trabajo
concurrente. La copia original conserva todas las imágenes. Usa una
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

## Identidad de Learning y Storage

El servicio main reutiliza las columnas de presentación existentes de SOFIA
Learning y su cliente autenticado. La selección se publica por el canal existente
`auth:set-state`, como `organizationId` opcional; no aparece en `auth:get-state`.
Se conserva revisión privada para rechazar selecciones obsoletas. La selección
no concede permisos: se exige membresía activa en `organization_users` antes
de consultar marca y antes de guardar. Si no hay selección, únicamente una
membresía única puede resolverse automáticamente. Un equipo usa el scope del
trabajo y su guarda, independiente de la selección del chat.

El logo se descarga del host HTTPS exacto de SOFIA y ruta Storage, sin redirecciones
ni credenciales en URL. Máximo 2 MiB y 8 segundos; PNG/JPEG/WebP/GIF se normalizan
con límite de 16 MP, tamaño 480 × 240 y 64 KiB. Se incrustan los bytes; los
documentos no dependen de URLs remotas. La consulta de marca también vence a los
8 segundos. Los colores de texto se ajustan para contraste sobre blanco.
Si Learning conserva los tres colores de fábrica, la paleta se deriva del logo,
reutilizando el extractor de presentaciones; una paleta configurada conserva prioridad.

La portada incorpora logo proporcional, título, subtítulo y metadatos conocidos;
los encabezados tienen marca compacta y los destacados usan `>` de Markdown.
No se inventa versión ni clasificación de confidencialidad. Las preferencias
explícitas prevalecen; `useOrganizationBranding: false` omite marca y conserva
guardas. Un recurso ausente produce aviso `design_notice` en herramientas o
`designNotice` en artefactos, visible en chat/panel. Una caída de consulta produce
respaldo editorial; falta de membresía o cambio de actor/contexto bloquea guardar.
No se modifica base, bucket, RLS ni la referencia del usuario.

Evidencia de identidad y diseño en
`openspec/changes/apply-organization-document-branding/reports/`.
