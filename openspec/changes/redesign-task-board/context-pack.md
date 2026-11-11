# Tablero y lista de tareas

- Actor: integrante autorizado del proyecto de la organización activa de Learning.
- Problema: filtros ocupan varias filas y la vista no comunica el avance por estados.
- Resultado: vista Tablero predeterminada y Lista alternativa; cambio de vista conserva filtros y selección dentro del proyecto.
- Contratos: `projectTaskFilters`, `listTasks`, `estimate_points`, `getTaskOptions`, `updateTask`; sin nuevos canales.
- Decisión: dificultad utiliza puntos de estimación existentes, con rangos documentados y no la prioridad. Un proyecto sin estados muestra columnas vacías de orientación que no son destinos de escritura.
- Riesgos: respuestas tardías, paginación filtrada, responsables sin perfil, estados desconocidos, arrastre no confirmado y lector sin permisos. Se conservan respuestas por clave del hook de colección y ninguna mutación se presenta como guardada antes de confirmación.
- No objetivos: edición masiva, asignaciones múltiples inexistentes en el modelo, orden manual persistente entre tarjetas ni cambios globales de esquema.
- HITL: las modificaciones siguen pasando por la confirmación main existente; el arrastre no la evita.
