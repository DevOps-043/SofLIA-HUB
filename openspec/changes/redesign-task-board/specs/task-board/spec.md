## ADDED Requirements

### Requirement: Tablero y lista
El panel MUST ofrecer Tablero por estado como vista inicial y Lista como alternativa, con los mismos filtros y tareas. MUST conservar acceso por teclado al detalle y a sus controles.
El desplazamiento horizontal del tablero MUST ser grueso y contrastado en ambos temas y permanecer en el borde inferior del área disponible del tablero, sin flotar a media altura cuando hay pocas tareas.

#### Scenario: Cambiar vista
- **WHEN** la persona cambia entre Tablero y Lista después de filtrar
- **THEN** se conserva la selección de filtros y las tareas visibles, sin reiniciar la consulta por cambiar únicamente la vista.

### Requirement: Dificultad y responsables
La interfaz MUST mostrar y filtrar dificultad sobre `estimate_points`, separada de `priority_id`; MUST mostrar el responsable real o «Sin asignar» cuando no existe.

#### Scenario: Filtrar dificultad
- **WHEN** se elige una dificultad o se combina con estado, responsable, ciclo y búsqueda
- **THEN** la consulta aplica esos filtros antes de paginar y ambas vistas reflejan el mismo resultado.

### Requirement: Movimiento confirmado
El tablero MUST permitir mover una tarea a otro estado disponible sólo a quien puede escribir y MUST mantener la confirmación main y la revisión de la tarea.

#### Scenario: Movimiento cancelado o incierto
- **WHEN** se cancela o no se confirma una actualización iniciada por arrastre
- **THEN** no se presenta la tarjeta como guardada en la nueva columna ni se reenvía automáticamente la mutación.

### Requirement: Estados verificables
El tablero MUST representar carga, error, vacío y resultados parciales, sin inventar tareas ni asignar IDs artificiales de estado a la base.

#### Scenario: Proyecto sin estados configurados
- **WHEN** no existen opciones de estado
- **THEN** se muestra un tablero vacío de orientación y no permite guardar movimientos hacia columnas artificiales.

### Requirement: Flujo completo e iconografía
El tablero MUST representar Backlog, Pendientes, Por hacer, En curso, En revisión, Completadas y Canceladas, además de conservar los estados personalizados. Pendientes MUST distinguirse por el nombre de su estado sin crear otro valor del enum de persistencia. La navegación del proyecto y las fases MUST usar siluetas diferenciadas y adaptarse al tema.

#### Scenario: Estados pendientes y por hacer del mismo tipo
- **WHEN** existen dos estados de tipo `todo` llamados Pendientes y Por hacer
- **THEN** cada columna conserva sus tareas e ID y se puede crear, filtrar o mover usando el ID configurado correspondiente.

#### Scenario: Falta una fase configurada
- **WHEN** una fase del flujo no tiene un estado real configurado
- **THEN** su columna vacía permanece visible sin ofrecer creación ni permitir arrastre a un ID artificial.
