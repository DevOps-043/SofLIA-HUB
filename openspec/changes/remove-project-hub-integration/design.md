# Diseño de retirada

La vista de carpetas usa ProjectHub como nombre interno, pero administra datos Lia y se conserva completa. Se retira UnifiedProjectHub y la sección externa, además de los clientes IRIS antiguos. La identidad SOFIA compartida se extrae a electron/sofia sin copiar contratos de proyectos.

Meeting Ops conserva fuentes, extracción, minutas, aprobaciones y acciones históricas. Se eliminan destinos externos, controles y canal de publicación, sin marcar como sincronizada ninguna acción pendiente. Los campos persistidos antiguos se conservan para poder leer registros existentes. No hay migración de datos ni limpieza de tokens o sesiones en disco.

Rollback: revertir el diff en Git. No hay efectos externos que revertir. La integración anterior queda descrita como histórica.
