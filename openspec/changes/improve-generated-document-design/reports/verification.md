# Verificación de diseño de documentos

Fecha: 11 de octubre de 2026. Estado: implementación y QA terminados.

## Resultado

Word y PDF reutilizan bloques y preferencias tipográficas. El diseño
predeterminado tiene título editorial, subtítulo, metadatos discretos,
jerarquía negra, cuerpo de 11 puntos y formato Carta. Las tablas conservan
celdas vacías, tienen anchos proporcionados, alineación por columna,
contraste, bordes, padding, filas alternadas y cabecera repetida.
Los encargos breves no tienen portada adicional; una decisión explícita
prevalece sobre la portada automática de informes extensos.

Chat, equipos y canales admiten ajustes declarativos de usuario o skill.
Se conserva el generador editable y las guardas de artefactos; no se agregan
dependencias, IPC ni permisos. La vista Word reconoce sus estilos de título,
subtítulo y metadatos. PDF escapa contenido y libera su ventana oculta al
terminar, fallar o vencer el deadline de 30 segundos.

## Pruebas

- `npm run verify:pr`: aprobado. 54 items OpenSpec válidos; typecheck, lint
  incremental (221 archivos), documentación y harness aprobados.
  381 archivos de pruebas aprobados, uno omitido; 4.049 pruebas aprobadas y
  una omitida. Duración de la suite: 88,96 segundos.
- Pasada focalizada: 75 pruebas aprobadas en cinco archivos del generador,
  PDF, equipos, lector de artefactos y visor.
- `npm run build:app`: aprobado; typecheck y bundles de renderer, main y
  preload correctos. Persisten avisos generales de tamaño de chunks e
  imports dinámicos. La compilación detuvo el proceso dev existente; se
  reinició `dev:app` con los cambios aplicados.
- Casos nuevos: título duplicado, portada automática/forzada/desactivada,
  preset/fuente/acento, rechazo de CSS y fuentes no admitidas sin escribir,
  tablas con celdas vacías y barras escapadas, anchos proporcionados,
  numeración de listas independientes, sangría anidada, bloques de código,
  HTML hostil, vínculos no seguros y contraste de cabeceras.
- PDF: éxito, fallo de carga, preferencia inválida y timeout de impresión
  comprueban liberación de ventana y ausencia de archivos parciales.

## Verificación visual real

Los ejemplos de `test/manual/document-design/fixtures.ts` usan datos de
demostración; no describen un cliente real. El generador produjo un documento
breve y un informe con tabla larga. Se regeneraron con el código final.

Se intentó `render_docx.py` de la skill documents: diagnosticó que
`soffice.exe` no está instalado. Se utilizó Word instalado en una instancia
oculta de QA para exportar ambos DOCX a PDF y Poppler del runtime para render
PNG. Se inspeccionaron todas las páginas: breve, una; informe, cinco.
No se encontraron recortes, superposiciones, títulos huérfanos, filas
truncadas ni errores de paginación. Las seis imágenes `breve-page-1.png`
e `informe-page-1.png` a `informe-page-5.png` registran el resultado.

El smoke `test/manual/document-design/pdf-smoke.ts` ejecutó el generador
real en Electron y terminó con código 0. Sus dos PDF se renderizaron con
Poppler: una y cinco páginas, inspeccionadas completas. Las imágenes
`pdf-breve-page-1.png` y `pdf-informe-page-1.png` a
`pdf-informe-page-5.png` muestran la salida final. Se comprobó también la
continuación de cabecera de tabla y el bloque de lista anidada entre páginas.

## Límites y entrega

La vista Word es de lectura, no una reproducción completa de paginación y
personalización de un archivo externo. Los ajustes declarativos admiten
tres presets y tres fuentes; no constituyen un editor de plantillas libre.
La generación no requiere Office; Word solo se utilizó para QA de estos
ejemplos. No se generó instalador ni se publicó una versión.

Los DOCX/PDF y bundles de QA quedan en `.git/document-design-qa` y
`.git/document-design-*.cjs`, fuera del contenido versionado. El smoke y las
instancias de Word de QA terminaron; la aplicación del usuario se conserva.
No se archivó este cambio ni se realizó una nueva revisión independiente.
