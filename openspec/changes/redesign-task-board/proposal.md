## Why

El panel de tareas presenta filtros grandes y una lista plana que dificulta leer estados y responsables. El usuario solicita un tablero por columnas inspirado en su referencia visual y una vista alternativa de lista, con dificultad en lugar de prioridad.

## What Changes

- Tablero por estados reales y lista compacta con el mismo conjunto de filtros.
- Flujo visible de siete fases (Backlog, Pendientes, Por hacer, En curso, En revisión, Completadas y Canceladas) e iconos propios en fases y navegación del proyecto; conserva estados personalizados e IDs reales, sin persistir columnas de orientación.
- Barra de búsqueda y filtros compactos de estado, responsable, dificultad y ciclo; limpiar filtros y actualizar tanto tareas como opciones.
- Dificultad basada en `estimate_points`: baja hasta dos puntos, media mayor de dos y hasta cinco, alta mayor de cinco, y sin estimar cuando es nulo. La selección del editor guarda dos, cinco u ocho puntos; valores existentes se conservan si no se modifica esa selección.
- Tarjetas con responsable, dificultad, fecha y etiquetas; creación desde la columna y cambio de estado por arrastre con la confirmación vigente. La edición por teclado conserva el selector de estado.
- Consulta directa a IRIS con dificultad filtrada antes de paginar. No renombrar ni reutilizar `priority_id` como dificultad.

## Capabilities

### New Capabilities
- `task-board`: tablero y lista de tareas con dificultad y filtros coherentes.

### Modified Capabilities

Ninguna.

## Impact

Renderer, estilos, contrato tipado del filtro de tareas y consulta directa existente. No requiere nuevas tablas, migraciones, dependencias, credenciales ni canales IPC. Mantiene permisos, aislamiento, confirmaciones de mutación y estados de error/cancelación.
