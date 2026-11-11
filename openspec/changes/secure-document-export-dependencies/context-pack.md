# Contexto del cambio

- Objetivo: retirar dependencias afectadas de exportación documental preservando archivos y APIs existentes.
- Usuario o actor: persona/agente autorizado que genera XLSX/PPTX; datos e imágenes son fronteras no confiables.
- Alcance: pins de padres actuales ExcelJS/PptxGenJS y overrides acotados por versión para uuid 11.1.1/image-size 2.0.4; revisión de API/lock/hooks, archivos reales y Node/Electron, regresiones y gate/build.
- No objetivos: cambiar exportadores, formatos, UI/IPC, permisos, modelos o datos remotos; declarar todos los avisos corregidos; probar Office instalado o certificar render visual sin ejecución.
- Restricciones: preservar 24 unidades y trabajo existente; no forzar overrides globales, no editar node_modules para mantener parches y no ejecutar fixtures capaces de consumir recursos sin guardas de QA.
- Contratos afectados: resolución transitiva; ExcelJS sólo usa uuid.v4 sin argumentos. Los bundles CJS/ESM de PptxGenJS 4.0.1 no importan image-size; conserva dependencia declarada. La diferencia de API archivo/buffer de image-size 2 se comprueba explícitamente.
- Riesgo y HITL: versiones mayores transitivas; exige demostrar compatibilidad específica de consumidores y mantener retiro documentado. QA usa archivos sintéticos locales, sin credenciales, mensajes, datos de negocio o control del escritorio.
- Criterios verificables: reproducción acotada de defecto UUID/ICNS, CJS/ESM, XLSX con formato condicional/IDs y roundtrip, PPTX con imagen/chart y OOXML, copias físicas seguras, auditoría comparable sin afectados nuevos y gate/build con fuentes estables.
- Incertidumbres: precisión visual de Office/LibreOffice y otros sistemas no se infiere de OOXML. Los bloqueos IRIS/backend e Intel Python y la revisión independiente siguen pendientes.
