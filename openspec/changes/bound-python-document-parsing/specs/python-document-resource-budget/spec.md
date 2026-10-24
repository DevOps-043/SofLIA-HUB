## Purpose

Reducir trabajo y estructuras documentales excesivas antes de devolver contenido local, con rechazos explícitos y manteniendo coherencia entre productor Python y consumidor main.

## ADDED Requirements

### Requirement: Admisión de Office acotada
El lector MUST validar presupuesto del contenedor y XML antes de invocar bibliotecas Office. MUST rechazar expansión excesiva, DTD/entidades, coordenadas fuera de límites y paquetes ambiguos sin extraer archivos.

#### Scenario: Paquete fuera de presupuesto
- **WHEN** el paquete declara o entrega entradas/expansión/estructura XML fuera de límites
- **THEN** se rechaza antes del parser y no se entrega contenido parcial

### Requirement: Construcción incremental coherente
El lector MUST aplicar cuotas acumuladas de texto, tablas y celdas antes de ampliar la salida. MUST contar unidades compatibles con el consumidor y validar también la salida redactada.

#### Scenario: Exceso acumulado o ampliación por redacción
- **WHEN** una conversión o sus marcadores exceden el presupuesto público
- **THEN** se devuelve error controlado de recursos y no una respuesta exitosa que main deba rechazar

### Requirement: Recursos y compatibilidad
La lectura MUST usar la misma fuente abierta durante validación/conversión y cerrar archivos/libros ante éxito o error. MUST conservar texto/tablas normales, protección y API existente, declarando parcialidad de páginas sin inventar totales.

#### Scenario: Fallo después de abrir
- **WHEN** falla el parser o se alcanza una cuota durante lectura
- **THEN** se cierran recursos propios y el siguiente documento puede procesarse sin repetir el anterior
