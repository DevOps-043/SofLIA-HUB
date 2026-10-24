# Lectura documental local y privacidad

Estado: implementado en `secure-python-document-boundary` y ampliado en
`bound-python-document-parsing`; evidencia y revisiones pendientes en sus reportes.

<!-- evidence: electron/python-tools-handlers.ts -->
<!-- evidence: electron/python-tools-service.ts -->
<!-- evidence: electron/python/privacy-store.ts -->
<!-- evidence: electron/python/document-snapshot.ts -->
<!-- evidence: electron/python/tools-contract.ts -->
<!-- evidence: src/shared/python-tools.ts -->
<!-- evidence: python/tools_sidecar/document_budget.py -->
<!-- evidence: python/tools_sidecar/office_preflight.py -->

## Selección, autorización y contrato

Los cinco canales `pytools:*` requieren la ventana principal registrada, su
marco principal, documento de la aplicación y sesión autenticada vigente.
Main comprueba aridad y tipos antes de llamar al servicio. El contrato compartido
se usa en preload y wrapper del renderer; no existe ejecución Python genérica.
Estado y preferencias no arrancan el lector. Logs incluyen canal, código y
correlación, sin texto, tablas, nombres de archivos ni errores crudos del parser.

`pythonTools.parseDocument()` del renderer recibe **cero argumentos** y abre un
selector nativo. Este cambio de contrato rechaza las llamadas antiguas con ruta;
no se encontró consumidor renderer de producción. Los lectores main de contexto
de escritorio y computer-use conservan `parseDocument(filePath,maxPages,context?)`.
No se añaden herramientas ni permisos de agentes runtime.

La selección admite PDF, XLSX, XLSM, PPTX y DOCX regulares de 4 bytes a 50 MiB.
Rechaza UNC, enlaces finales y firma inicial incompatible. Main mantiene un
descriptor, verifica identidad/tamaño/tiempos y dos lecturas con SHA-256, y crea
una copia privada con nombre opaco. Python recibe esa copia. Esto comprueba
estabilidad de bytes; no certifica el contenido completo ni sustituye antivirus.
El original nunca se modifica ni elimina. Hay un slot de lectura y exclusión
del selector hasta su cierre físico, incluso si perdió el contexto solicitante.

## Política y fallos

`privacy-config.json` conserva una preferencia **de máquina**, no de cuenta.
Sólo ausencia inicial significa opt-in desactivado; corrupción, error de acceso
o desaparición durante la carga rechazan la operación. La carga admite como
máximo 1024 bytes y una clave booleana. Se escribe en temporal exclusivo,
sincroniza y renombra antes de publicar el estado. Un fallo no se confirma como
guardado; commit incierto invalida la revisión y obliga a releer. No se borran
temporales ajenos si colisionan los nombres. No hay vigilancia de cambios
externos de configuración mientras esté cacheada ni cifrado de esta preferencia.

Activar protección puede guardarse aunque falte Python; las lecturas protegidas
se rechazan hasta disponer de él. Desactivar requiere confirmación nativa
vigente, cancelable, con plazo de 120 segundos. No revierte contenido ya
compartido. Cada cambio invalida lecturas anteriores, incluso un ciclo de
activar/desactivar que regrese al valor original. Cambio de sesión o navegación
descarta resultados pendientes. Contexto de escritorio limpia además el
inventario y revalida el contexto después de cada espera antes de entregarlo.

Cancelar, agotar el plazo o recibir un resultado inválido retira el hijo de
herramientas, conservando el proceso de voz. El cierre no confirmado mantiene
la barrera contra reemplazo. Las copias no se eliminan mientras un hijo retirado
pueda leerlas: se difiere limpieza hasta `close` y se informa
`cleanupPending`/`recoveryRequired`. Un crash del Hub puede dejar copias privadas;
no existe barrido automático ni garantía de borrado forense. No volver a leer
ante cierre no confirmado; reiniciar la aplicación y revisar sus temporales
con el lector ya cerrado, sin eliminar documentos originales.

## Alcance de redacción y cuotas

La redacción local por patrones cubre Markdown, celdas y etiquetas `sheet`;
el contexto Office redacta también título y procedencia. Con protección activa,
Office omite imagen de apoyo y rechaza fallback UIA/captura si falla el documento;
DOCX no usa mammoth crudo. Con protección desactivada se conserva la degradación
existente. Texto manual, capturas de otras aplicaciones y otras fuentes del Hub
mantienen sus políticas actuales. Los patrones pueden omitir PII y no ofrecen
anonimización completa ni detección general de nombres/direcciones.

| Frontera | Límite |
| --- | --- |
| Texto/redacción y Markdown | 400000 unidades UTF-16 por campo |
| Páginas solicitadas | Entero 1–200 |
| Tablas | 100; 2000 filas por tabla; 200 columnas por fila |
| Celdas acumuladas | 20000; 400000 unidades UTF-16 en total |
| Entidades PII | 20000; tipo permitido, posiciones Unicode ordenadas y sin solapar |
| Lectura documental / redacción | 60 s / 10 s, sin retry automático |

La metadata pública tiene vocabulario cerrado. Se retiran campos desconocidos,
trazas y rutas internas; errores usan un catálogo fijo. Las cuotas de archivo,
transporte y resultados no son límites duros de RAM/CPU del sistema operativo
ni contención completa de ZIP malicioso o parsers vulnerables.

## Presupuesto dentro de Python

`documents.py` abre una única fuente regular y pasa el descriptor al preflight
y a la biblioteca; comprueba identidad/tamaño/tiempos y cierra en todos los
desenlaces. Excel cierra también su libro ante fallos. Windows puede informar
ctime distinto entre stat de ruta y primer fstat: se comparan identidad, tamaño
y mtime en esa transición, y también ctime entre las observaciones del descriptor.
Esto no garantiza inmutabilidad frente a un escritor que oculte cambios de stat.

Antes de las bibliotecas Office, `office_preflight.py` comprueba ZIP clásico,
sin multidisco ni ZIP64, nombres relativos únicos, método stored/deflate y sin
cifrado. Acota el directorio central antes de construir ZipFile y lee entradas
en chunks comprobando bytes reales/CRC. No extrae archivos. XML se inspecciona
sin construir DOM, incluso UTF-16: rechaza DTD y controla profundidad, elementos,
coordenadas Excel y spans que amplían celdas Word/PowerPoint. Se reinician las
dimensiones Excel para que una dimensión falsa no oculte celdas reales.
Las celdas Excel conservan espacios interiores y saltos de línea; su proyección
Markdown convierte el salto en espacio como antes, sin alterar la matriz.

| Admisión Office | Límite |
| --- | --- |
| Directorio ZIP / entradas | 2 MiB / 4096 |
| Entrada inflada / total inflado | 16 MiB / 64 MiB |
| Ratio declarado de expansión | 1000 |
| XML | Profundidad 128; 500000 elementos acumulados |
| Hojas/diapositivas / tablas XML | 200 / 100 por paquete |
| Coordenadas de hoja / spans | 2000 filas y 200 columnas; spans hasta 200 |

`document_budget.py` aplica cuotas mientras construye texto y tablas, incluyendo
separadores/escape Markdown, relleno de celdas y coste UTF-16. La inspección de
celdas vacías también consume presupuesto de trabajo. El exceso se rechaza con
`DOC_RESOURCE_LIMIT`; no se devuelve el antiguo truncado cuyo sufijo superaba
la cuota ni tablas parciales silenciosas. La redacción se valida antes/después:
sus marcadores pueden ampliar el texto. Documentos antes parcialmente leídos
pueden requerir dividirse para entrar en estos límites explícitos.

PDF solicita hasta las páginas admitidas más una. Si detecta más páginas,
declara `truncated` y `pagesParsed`, omitiendo el total desconocido; no inventa
`pages`. Las bibliotecas todavía pueden crear estructuras propias y el lector
PDF puede recorrer metadata adicional. Permanecen el timeout/kill main y el
riesgo residual de RAM/CPU; estas cuotas no constituyen un sandbox ni certifican
ausencia de vulnerabilidades en documentos admitidos.

## Verificación y recuperación

`npm run python-tools:smoke:native` usa Electron real con perfil temporal,
preload sandbox, servicio y diálogos simulados, red bloqueada y datos ficticios.
No certifica selección humana, parsers ni runtime distribuible. Las pruebas
Python usan el intérprete de QA identificado, XLSX/DOCX temporales y stdio real;
no requieren cuentas, documentos privados, micrófono ni modelos.

Pruebas reproducibles sin pytest: ejecutar el intérprete elegido con
`-B -X utf8 python/tools_sidecar/tests/run_tests.py`; son pruebas stdlib de recursos.
Agregar `--formats` exige las dependencias del lector y ejecuta PDF, XLSX/XLSM,
PPTX, DOCX, privacidad y stdio con fixtures ficticios. El runner inhibe bytecode
también en hijos. Falla si faltan dependencias, sin descargarlas ni omitir casos
silenciosamente. Este comando es separado del gate Node actual; una ejecución
QA con otras versiones no certifica el runtime distribuible fijado.

Al revertir, restaurar juntas las capas main/preload/renderer, consumidores y
contratos de esta unidad. El rollback reabre las fronteras aquí descritas;
conservar las otras unidades de reducción de deuda. No hay SQL ni migración
remota. No deducir un porcentaje global nuevo a partir de pruebas aprobadas.
