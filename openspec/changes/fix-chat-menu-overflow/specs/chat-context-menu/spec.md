## ADDED Requirements

### Requirement: Opciones visibles sin desplazar la lista
El menú de una conversación SHALL mostrarse fuera del contenedor desplazable,
anclado al botón de opciones y dentro del viewport. SHALL abrir hacia arriba
cuando no quepa debajo y exista más espacio encima, sin desplazar la lista al
recibir foco. SHALL actualizar su posición al desplazar o redimensionar.

#### Scenario: Último chat junto al borde inferior
- **WHEN** se abre su menú de opciones
- **THEN** sus acciones aparecen completas por encima del botón si no caben debajo
- **AND** la lista conserva su posición de scroll

#### Scenario: Barra lateral izquierda o derecha
- **WHEN** el botón está junto a un borde lateral del viewport
- **THEN** el menú permanece dentro del área visible

### Requirement: Interacción de las opciones
El menú SHALL conservar acciones y permisos, admitir flechas, Inicio, Fin y
Escape, y cerrarse con interacción exterior. Las acciones SHALL evitar la
selección accidental de la conversación.

#### Scenario: Cierre con Escape
- **WHEN** se pulsa Escape dentro del menú
- **THEN** el menú se cierra y el foco vuelve al botón sin desplazar la lista

#### Scenario: Acción desde el menú
- **WHEN** se activa una opción permitida
- **THEN** se ejecuta esa acción una sola vez y se cierra el menú sin seleccionar el chat
