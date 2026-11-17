# Diseño

Monitoreo conserva su API: las llamadas periódicas concurrentes comparten una operación, y un contador de revisión evita publicar resultados antiguos tras stop, cambio de sesión o configuración. La revisión se consulta entre etapas de captura/OCR. Capturas explícitas permanecen disponibles. Los errores se notifican sin lanzar el evento especial error de EventEmitter cuando no tiene receptor.

PathMemory mantiene un único intervalo/watchers y una operación en curso con un bit de invalidación pendiente. Las ráfagas se agrupan sin colas crecientes. Stop invalida etapas futuras y publicaciones; IO ya iniciado puede terminar. Se consultan como máximo cuatro metadatos de archivos a la vez, conservando las 200 entradas por directorio y orden final existentes.

La caché de embeddings conserva un máximo de cuatro sesiones y 5000 vectores acumulados mediante LRU sobre el Map existente. Expulsar no borra SQLite ni reduce filas consideradas por una búsqueda: se recargan al consultar de nuevo. Las invalidaciones delete/clear actuales se conservan. El presupuesto de vectores no representa el heap total del proceso.

Reversión por diff; no requiere migraciones ni efectos externos.
