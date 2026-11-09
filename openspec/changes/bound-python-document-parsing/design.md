## Context

Ver context-pack/propuesta. Las cuatro familias usan bibliotecas locales; main valida el resultado después del parseo. No se cambia voz ni el protocolo v1. Se mantiene rama actual sin concurrencia para preservar las dieciocho unidades previas.

## Goals / Non-Goals

**Goals:** reducir expansión admitida y acumulación durante conversión, cerrar recursos ante rechazos y alinear cuotas del productor con main.

**Non-Goals:** hard limits del SO, parser sandbox, antivirus, recuperación de crash, certificar todas las versiones empaquetadas o rediseñar colas. La validación previa no vuelve inocuo un parser vulnerable.

## Decisions

- Extraer DocumentError a módulo común y reexportarlo desde documents para conservar imports. Añadir DOC_RESOURCE_LIMIT al catálogo main. Errores de parser se mantienen controlados, sin rutas/trazas en respuestas públicas.
- Abrir una vez un archivo regular local de hasta 50 MiB; pasar el descriptor a validación y bibliotecas, revalidar stat antes de devolver y cerrar con context manager. Así no se reabre una ruta sustituida entre preflight y parser. No prometer inmutabilidad frente a una escritura concurrente que oculte cambios de stat.
- Preflight Office sin extracción: EOCD clásico, sin multidisco/ZIP64; central hasta 2 MiB y 4096 entradas. Comprobar nombres únicos/relativos, método stored/deflate, sin cifrado; 16 MiB por entrada, 64 MiB inflados totales y ratio hasta 1000. Leer entradas en chunks comprobando bytes reales/CRC para no confiar sólo en metadata. El directorio se acota antes de construir ZipFile. Es política local explícita, no certificación completa ZIP.
- Inspeccionar XML mediante parser incremental sin construir DOM, rechazando DTD, más de 128 niveles o 500000 elementos acumulados. Validar coordenadas de hojas Excel (2000 filas/200 columnas) aunque sus dimensiones declaradas mientan. Sin entidad externa ni evaluación del contenido; los XML deben ser bien formados. No basta revisar prefijos ASCII porque UTF-16 también puede contener DTD.
- Un constructor de resultado administra Markdown (incluyendo separadores/escape), 100 tablas, 2000 filas/200 columnas, 20000 celdas y 400000 unidades UTF-16 tanto de texto como de celdas. Comprobar antes de retener/ampliar resultados. Rechazar exceso con código explícito en vez de truncar silenciosamente; no conservar el sufijo que supera el contrato. Hasta 200 hojas/diapositivas.
- Excel usa read_only/data_only, dimensiones reiniciadas después del preflight y cierre en finally. PDF solicita como máximo las páginas admitidas más una para detectar parcialidad; total se omite cuando no se conoce, pagesParsed/truncated son explícitos. Cada parser consume el constructor común; sus estructuras internas siguen siendo riesgo residual.
- Conservar redacción posterior y volver a validar cuotas después de redacción porque los marcadores pueden ampliar texto. No devolver supuestas lecturas protegidas incompatibles con main.
- Pruebas unittest sin dependencias para preflight/presupuesto, más pruebas de formatos/stdio con dependencias QA identificadas. Comando reproducible separado permite fijar intérprete; no se presenta ejecución QA como certificación del runtime distribuible ni se impone Python implícitamente al gate Node existente.

## Risks / Trade-offs

Archivos antes parcialmente legibles pueden rechazarse por cuotas: comunicar límite y pedir documento menor. Un ZIP admitido aún puede activar trabajo caro en terceros: permanecen timeout/kill main y riesgo RAM/CPU. Metadata PDF total desconocida se omite. No se toca configuración local ni se instala software. QA difiere de algunos pins; dejar evidencia explícita.

## Migration Plan

Baselines y regresiones; módulos comunes; integración de cuatro parsers/redacción; pruebas negativas y formatos reales ficticios; actualización canónica, autorrevisión, gate/build. Revisión independiente pendiente antes de archivar. Rollback conjunto de módulos/parsers/error main, conservando unidad previa y sin mutación remota.
