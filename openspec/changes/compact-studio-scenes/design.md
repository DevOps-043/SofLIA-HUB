## Context
El estudio central usa desplazamiento vertical y contiene dos monitores. Hay trabajo ajeno en creación de proyectos; este cambio se desarrolla en un worktree aislado.

## Decisions
Mantener un solo monitor y un dock inferior de escenas/fuentes. La lista muestra filas de 28 píxeles y conserva desplazamiento interno al exceder su capacidad, como un dock OBS; nunca obliga a desplazar todo el escenario para acceder a ella. En ventanas bajas el monitor cede espacio al dock.

Activar salida requiere una acción explícita. Una vez activa, cada clic cambia directamente el programa, conservando la pista y el contenido anterior si la fuente falla. Se eliminan efectos configurables y preparación intermedia del hook de UI. Los algoritmos del compositor conservan sus contratos internos y pruebas de transporte.

Los modos cámara/pantalla/combinada siguen representando la vista local; la salida continua contiene escenas, no mezcla la cámara de la llamada. No se presentan controles de composición local como controles del programa activo.

## Validation
Regresiones de selección, errores, limpieza, corte inmediato, navegación de salas y creación de fuentes. Revisar visualmente 1920×1080, 1280×720 y ventana estrecha; sin scroll central en escritorio. Ejecutar typecheck, lint, pruebas afectadas y verify:pr.
