# Resolución

HEAD incorpora correcciones posteriores a la integración audiovisual: conteos
numéricos, tablas/diagramas declarados, contrato correcto de imágenes PPTX/PDF,
preview-only del smoke y protección de copia de DLL sobre sí misma. Se conservan
esas versiones en los bloques en conflicto y los cambios entrantes que Git ya
combinó. `.gitignore` incorpora también el directorio de respaldo entrante.
El catálogo SQL y las cifras de pruebas se regeneran desde fuentes canónicas.

La solicitud actual autoriza editar `.env`: habilitar audiovisual local y
declarar FFmpeg/FFprobe con rutas de ejecutables comprobados. No se inventan
claves ni se reemplazan credenciales existentes. Las opciones multimodales se
añaden si faltan, conservando decisiones explícitas anteriores. El archivo
audiovisual separado sigue siendo respaldo compatible; `.env` tiene prioridad.
La bandera de release conserva false hasta empaquetar el motor multiplataforma.

Se guarda respaldo local de los archivos conflictivos y del índice por etapas.
Verificar ausencia de marcadores/entradas sin fusionar, contratos de ambas
áreas, typecheck, compuerta de PR y compilación antes del commit de fusión.
