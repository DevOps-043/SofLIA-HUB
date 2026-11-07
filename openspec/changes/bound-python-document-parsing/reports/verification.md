# Verificación de presupuesto documental Python

Estado: implementación, pruebas dirigidas, gate PR y build finales aprobados.
Revisión independiente pendiente antes de archivar.
Fecha local: 2026-10-23. Rama: codex/reduce-technical-debt.

## Cambio y baseline

Se conserva parse_document por ruta y DTO/protocolo. La admisión ZIP/XML se
separa de conversión y presupuesto incremental, con errores comunes. Las cuatro
familias usan descriptor abierto estable y constructor compartido. Excel cierra
el libro también en fallos. La redacción valida cuotas antes/después; PDF
declara parcialidad y omite total desconocido. Main proyecta DOC_RESOURCE_LIMIT
con mensaje fijo y accionable. No hay dependencias/canales/permisos nuevos,
cuentas reales, SQL, documentos personales ni despliegue. Se conservan las
dieciocho unidades previas y worktrees ajenos.

Baseline previo: 5449 pruebas TS aprobadas y cinco omitidas; diez pruebas Python
de documentos/privacidad bajo QA. La prueba roja inicial red.log reprodujo cinco
fallos: Markdown excesivo, UTF-16, celdas acumuladas, expansión ZIP y DTD UTF-16.

## Matriz y comandos

| Garantía | Evidencia |
| --- | --- |
| Central ZIP acotado antes de ZipFile y cuotas declaradas | test_document_resources: límites ZIP |
| Nombres originales, duplicados, CRC y ZIP64 rechazados antes de biblioteca | test_document_resources: ambiguos/CRC/ZIP64 |
| DTD UTF-16, profundidad, elementos, tablas/secciones acumuladas | test_document_resources: XML |
| Coordenadas Excel falsas y spans Word desmesurados | test_document_resources y fixture Excel real |
| Coste UTF-16, separadores, relleno y ampliación de marcadores | test_document_resources: presupuesto/redacción |
| Descriptor/libro cerrados y modificación descartada | test_document_resources: fallos/cierre |
| PDF parcial/completo, tablas PPTX/DOCX, XLSX/XLSM | test_documents_privacy con bibliotecas reales |
| Lector atiende ping, rechaza exceso y sigue respondiendo | test_documents_privacy con hijo/stdio real |
| Error público integrado y regresiones IPC/ciclo de vida | python-tools-contract, python-tools-ipc y python-sidecar |

Runner reproducible: el intérprete elegido ejecuta
`-I -S -B -X utf8 python/tools_sidecar/tests/run_tests.py` para contratos stdlib.
Quitar -S y añadir --formats exige las dependencias de formatos y ejecuta los
fixtures reales. No usa pytest, descargas ni casos omitidos silenciosamente;
bytecode inhibido también en hijos y cierre de proceso en finally.

QA actual Python 3.12.14: 19 unittest aprobadas también con site-packages
deshabilitado; 15 pruebas de formatos/privacidad/stdio aprobadas. Dependencias:
pdfplumber 0.11.9, openpyxl 3.1.5, python-pptx 1.0.2, python-docx 1.2.0. Algunas
difieren de los pins del runtime; no se certifica aquí el runtime distribuible.
Las cuatro suites TS dirigidas terminaron con 73 casos aprobados; typecheck y
lint enfocado pasaron. La compuerta final aprobó 5450 casos y cinco omitidos
en 212.50 segundos, con 493 archivos aprobados y dos omitidos. Las once etapas
terminaron con exit 0; lint revisó 262 archivos sin incidencias nuevas y los
enlaces de 681 Markdown activos fueron válidos. Ver gate-summary.json.

## Autorrevisión adversarial

Se intentaron refutar admisión antes de parser, cuotas acumuladas, falsa
geometría, expansión por atributo, cierre, coherencia Unicode y redacción.
No se generaron bombas reales ni se midió carga de usuarios: fixtures pequeños
y límites parcheados permiten cruzar las fronteras sin consumo peligroso.

first.log registró dos falsos DOCUMENT_CHANGED en Windows. Se reprodujo que
ctime de stat de ruta puede diferir del primer fstat; se compara ruta/descriptor
por identidad/tamaño/mtime y descriptor antes/después también por ctime. Hay
regresión dedicada; no se eliminó la detección de modificación durante lectura.

La ejecución stdlib sin dependencias detectó una falsa cobertura: ZipInfo
normalizaba separadores al escribir el fixture y al leerlo en Windows. El caso
ahora altera nombres locales/centrales en bytes y simula el parser para exigir
rechazo previo. Esa prueba reprodujo la aceptación del nombre normalizado; el
preflight comprueba además orig_filename, manteniendo la política de nombres
sin ambigüedad. No se atribuye extracción de archivos ni una fuga que no se vio.

La revisión añadió guardas de spans Word/PowerPoint antes de que las bibliotecas
expandan celdas, cuotas XML globales, comprobación temprana del descriptor y
revalidación después de redacción. Empaquetado revisado por código: el filtro
de tools_sidecar copia los nuevos módulos .py y excluye tests. No se ejecuta
verify:release ni se presenta el build de aplicación como certificación Python.

Esta es autorrevisión; revisión independiente pendiente antes de archivar.

La primera compuerta aprobó 5450 casos y cinco omitidos (200.32 s) y el primer
build también pasó. Una comprobación adicional durante esa ejecución detectó
pérdida de espacios dobles/saltos de línea en celdas Excel: excel-whitespace-red.log
la reprodujo. Después de esperar ambos procesos terminales se corrigió la
normalización específica de Excel, conservando la matriz y su proyección Markdown
previas. Se añadió regresión de formato real y se repiten gate/build sobre el
estado final; las primeras ejecuciones se conservan como before-compat.

## Límites y reversión

Cuotas reducen entrada/trabajo admitidos, pero terceros pueden construir objetos
propios antes de devolverlos. PDF puede recorrer metadata adicional; ZIP/XML
admitidos no se certifican libres de vulnerabilidades. No hay límite duro de
RAM/CPU del SO ni antivirus/sandbox nuevo. El timeout/kill main sigue vigente.
Los tests Python permanecen separados del gate Node; no hay CI Python probado
ni pruebas sobre todas las versiones empaquetadas. Preferencias globales,
temporales tras crash, otros IPC y deuda IRIS/backend siguen registrados.

Contrato canónico: docs/security/python-document-boundary.md. Rollback conjunto
de módulos/parsers/redacción y error main, conservando las dieciocho unidades
anteriores. Reabre rechazos tempranos; sin mutaciones remotas que revertir.
No se recalcula el índice experto histórico de 50.375% a partir de estas pruebas.

Logs: directorio temporal soflia-document-resources-2026-10-23. Resultados
terminales de gate/build y huellas se guardan en los resúmenes de esta carpeta.

El build final copió 3398 fuentes y produjo seis artefactos no vacíos, en
pulse-app-build-1AvTPV. Los diez archivos registrados (Python/TS y pruebas)
conservaron sus hashes durante el gate; los dos TS incluidos en la copia del
build coinciden por SHA-256. Python no forma parte de app:smoke:build y se
verifica por separado con el runner: no se presenta el build como su validación.
Ver build-summary.json, python-summary.json y source-before-gate.json.
