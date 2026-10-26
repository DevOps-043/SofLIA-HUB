# Verificación del tablero de tareas

Fecha: 2026-10-24. Estado: implementado y verificado localmente; sin cambios en cuentas reales.

## Resultado

Tablero por estados y lista compacta con el mismo conjunto de filtros. La barra muestra búsqueda, estado, responsable, dificultad y ciclo. Actualizar recarga tareas y opciones; limpiar elimina la selección. Las tarjetas identifican responsable, dificultad, fecha y etiquetas. Los contadores describen tareas cargadas y la paginación se mantiene explícita.

El flujo muestra Backlog, Pendientes, Por hacer, En curso, En revisión, Completadas y Canceladas, conservando estados personalizados. Pendientes y Por hacer pueden compartir tipo `todo` sin mezclar sus IDs. Las fases sin configuración real se muestran vacías sin acciones de creación o arrastre. El menú del proyecto reemplaza los iconos genéricos por SVG propios con planos de color; las fases usan siluetas específicas para bandeja, reloj, pendiente, progreso, revisión, completado y cancelado.

La dificultad usa los puntos existentes: baja hasta dos, media mayor de dos y hasta cinco, alta mayor de cinco y sin estimar para nulo. El editor guarda dos, cinco u ocho puntos; conserva puntos personalizados y prioridad anterior cuando sólo se modifica otro dato. El filtro se valida en el contrato compartido y se aplica directamente en IRIS antes de paginar. No se agregaron columnas, tablas, canales ni dependencias.

La creación desde una columna precarga su estado real. Arrastrar usa `updateTask` con revisión y conserva el control humano main existente; la interfaz no mueve la tarjeta hasta confirmar y volver a leer la base. El detalle permite cambiar estado por teclado. No se añade orden manual persistente entre tarjetas.

## Evidencia

- **242 casos aprobados, cero fallos**, entre TaskBoard, ProjectManagement, UnifiedProjectHub, base directa, HTTP de compatibilidad, contrato y bridge. Comando: `node node_modules/vitest/vitest.mjs run src/__tests__/components/TaskBoard.test.tsx src/__tests__/components/ProjectManagement.test.tsx src/__tests__/components/UnifiedProjectHub.test.tsx electron/__tests__/project-direct-database.test.ts electron/__tests__/project-management-http.test.ts electron/__tests__/project-hub-contract.test.ts electron/__tests__/project-hub-bridge.test.ts --silent`.
- Cobertura del filtro en la base usando el SDK real con transporte simulado: baja/media/alta/sin estimar, sin convertir la prioridad. La interfaz prueba filtros combinados, cambio de vista sin nueva consulta, limpieza, recarga de opciones y descarte de respuestas antiguas.
- Se verifican edición sin alterar puntos/prioridad anteriores, nueva tarea en columna, revisión al arrastrar, cancelación sin movimiento visual, lector sin escritura, página fallida que conserva tarjetas y fechas completadas sin marcarlas vencidas.
- Se prueban las siete fases vacías, estados personalizados y la separación de Pendientes/Por hacer; filtros, creación y arrastre para Backlog, Pendientes, En revisión y Canceladas, usando IDs reales. Las columnas sin configuración rechazan movimientos y no ofrecen escrituras.
- **Lint incremental: 65 archivos revisados sin deuda nueva**.
- `npm run verify:pr`: arnés, documentación, inventario, supply chain, OpenSpec estricto y pruebas de calidad correctos. Se detiene en el error previo `electron/gmail/raw-message.ts:19`, propiedad `newline`. No se declara aprobada la compuerta global.
- Smoke Electron `node test/manual/task-board/smoke.mjs <directorio>`: siete fases, tablero/lista, filtros compartidos, arrastre y lectura posterior, claro/oscuro, vacío y 360 px. Se inspeccionaron capturas, incluyendo `tareas-flujo-completo.png` con doce tareas simuladas y los iconos nuevos. El selector lateral se compacta antes de capturar y el tablero se desplaza dentro de su propio contenedor.

## Revisión adversarial y límites

Se intentó escribir como lector, guardar dificultad inválida, mezclar una respuesta anterior con filtros nuevos y presentar una cancelación como movimiento guardado. Los casos se rechazan o mantienen el estado confirmado. Los estados desconocidos no se eliminan de la vista; columnas de orientación sin IDs reales no son destinos persistibles. Las fechas completadas no se muestran como vencidas.

Se conservaron los permisos, organización y conexión directa existentes. Las pruebas de UI y del selector nativo usan datos simulados; no se crearon ni movieron tareas reales. Los errores de red, permisos efectivos, incertidumbre de escrituras y limitaciones de transacción conservan los contratos anteriores. La revisión visual no acredita una prueba manual de lector de pantalla ni de todas las plataformas.

Reversión: retirar el filtro `difficulty`, los componentes/estilos nuevos y restaurar ProjectTasks; las estimaciones y prioridades guardadas permanecen en el esquema existente, sin migración que revertir.
