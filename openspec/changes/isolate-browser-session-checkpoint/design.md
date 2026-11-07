## Context

Ver motivación en `proposal.md`. `IntegratedBrowserService` construye snapshots y gobierna vistas/perfiles; `BrowserSessionStore` valida el formato y serializa E/S por archivo con reemplazo atómico. El estado intermedio de autosave/cierre está repartido entre ambos sin una unidad verificable propia.

## Goals / Non-Goals

**Goals:** dar un único dueño al temporizador, última escritura y revisión de cierre; probar sus transiciones sin simular Electron; integrar el módulo con el store y servicio existentes.

**Non-Goals:** mover las vistas o la limpieza de particiones; duplicar la cola del store; cambiar requisitos, formato persistido, API pública o permisos.

## Decisions

- Crear `BrowserSessionCheckpoint`, que recibe solamente la capacidad `save` del store y una función para reportar fallos del autosave. No recibe el servicio entero ni accede a Electron, perfiles globales o filesystem.
- El servicio conserva la selección de datos persistibles, recuperación pendiente, capacidad habilitada y guardas de generación/perfil. En el cierre entrega callbacks explícitos para preparar, capturar, validar y esperar la limpieza. El checkpoint gobierna orden, reintento de la última escritura del mismo perfil y estabilización durante E/S.
- Conservar estados committed/flushing y revisión de cancelación dentro del checkpoint. El servicio consulta sus estados para las mismas guardas existentes. Reiniciar el seguimiento al cambiar de perfil o finalizar limpieza no habilita el cierre por sí solo.
- Verificar la revisión también después de la última espera de limpieza: la cancelación debe invalidar todo el checkpoint, incluida esa ventana de concurrencia.
- Conservar 250 ms y `unref` en el autosave; capturar el snapshot al ejecutarlo. Comparar el contenido ignorando únicamente `savedAt` para evitar bucles de escritura por timestamp.
- Preferir composición con contratos pequeños a herencia/mixins o pasar `this` completo: esos mecanismos mantendrían acoplamiento implícito y permitirían al módulo alterar vistas.

## Risks / Trade-offs

- Carrera de cierre/cancelación → revisión interna verificada después de cada espera y pruebas con promesas retenidas.
- Fallo antiguo contaminando otro perfil → identidad de última promesa, scope en el snapshot y reinicio tras drenar el perfil saliente.
- Pérdida de datos por recuperación pendiente → construcción de snapshot continúa exclusivamente en el servicio, con pruebas existentes sin modificar.
- Más superficie interna → una sola clase del dominio, sin interfaces públicas del producto ni dependencias nuevas; medir campos y duplicaciones retirados, sin convertir líneas movidas en porcentaje global de deuda.

## Migration Plan

No requiere migración de archivos. Probar servicio/store/lifecycle antes y después, contratos del checkpoint, smoke nativo con almacenamiento real temporal y `verify:pr`. Revertir sólo esta unidad (módulo, integración, pruebas y documentación) sin revertir los bloques anteriores. Conservar evidencia; no archivar el cambio sin revisión independiente.
