# Contexto del cambio

- Objetivo: reducir trabajo y estructuras excesivas antes de convertir documentos Python, manteniendo los contratos de la unidad anterior y consumidores main.
- Actor: lector documental local autorizado; sin permisos runtime nuevos.
- Evidencia: documents.py acumula todas las tablas/texto antes de recortar; el sufijo de truncado supera 400000; openpyxl cierra sólo en éxito; no hay preflight de Office ZIP/XML.
- Alcance: presupuesto incremental de salida UTF-16 alineado con main, validación de contenedores y XML antes de parsers, descriptor estable y cierre en error, errores controlados y pruebas reproducibles de límites/compatibilidad.
- No objetivos: sandbox del SO, límites duros de RAM/CPU, antivirus, certificación de PDF/ZIP, extracción de archivos, descarga de dependencias ni rediseño del protocolo/cola del sidecar.
- Restricciones: reutilizar codex/reduce-technical-debt, preservar dieciocho unidades y worktrees ajenos, sin concurrencia, cuentas, documentos privados, SQL, perfiles ni despliegues.
- Contratos: parse_document(file_path,max_pages) y DTO conservados; nuevo DOC_RESOURCE_LIMIT proyectado por main. Rechazar exceso en lugar de entregar una estructura parcial silenciosa. PDF solicitado por páginas conserva metadata de parcialidad.
- Criterios: paquetes excesivos/DTD/entidades/coordenadas falsas rechazados antes del parser, cuotas acumuladas antes de construir salida grande, recursos cerrados en error, texto/tablas normales y privacidad compatibles; fixtures reales y adversariales, tipos/lint/gate/build y evidencia.
- Incertidumbres: bibliotecas materializan estructuras propias antes de devolverlas; la prevalidación reduce entrada admitida pero no limita el SO ni certifica vulnerabilidades. QA disponible usa pdfplumber 0.11.9, openpyxl 3.1.5, python-pptx 1.0.2 y python-docx 1.2.0; no equivale a todas las versiones fijadas del runtime.
- Baseline: unidad anterior verify:pr 5449 aprobadas, cinco omitidas; diez pruebas Python QA aprobadas. No se recalcula el índice global por pruebas/líneas.
