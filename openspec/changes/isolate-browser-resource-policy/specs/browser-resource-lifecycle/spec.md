## Purpose

Gestionar el ciclo de vida de vistas del navegador con una política coherente de recursos que preserve trabajo protegido, identidad de pestañas y cancelación de temporizadores.

## ADDED Requirements

### Requirement: Protección coherente de vistas
La política MUST proteger la disposición ante presupuesto, las pestañas presentadas ante inactividad y el trabajo activo en ambas vías. MUST conservar snapshot/identidad lógica al retirar una vista elegible y mantener selección LRU, warm, gracia y throttling existentes.

#### Scenario: Presión mientras una pestaña oculta reproduce o captura
- **WHEN** se abren más vistas que el objetivo y una candidata tiene audio/captura/carga/DevTools activos
- **THEN** esa vista no se destruye; se elige otra elegible o se mantiene exceso temporal protegido

### Requirement: Reevaluación y cancelación
La política MUST reevaluar estado actual al vencer el timer y recuperar el presupuesto cuando cese protección. Stop MUST invalidar callbacks antiguos y no dejar efectos sobre un perfil/ventana reemplazados. MUST mantener un único timer útil y atender el vencimiento más próximo.

#### Scenario: Trabajo protegido termina
- **WHEN** cesa trabajo en un conjunto que excedía el objetivo
- **THEN** el siguiente retry retira sólo vistas elegibles según estado actual

#### Scenario: Perfil o ventana reemplazados
- **WHEN** stop invalida un timer y después llega su callback antiguo
- **THEN** no consulta ni destruye vistas del contexto nuevo

### Requirement: Integración modular verificable
El servicio MUST conservar dueño de vistas/perfil/snapshot y métodos públicos sin canales ni formatos nuevos. Errores del timer MUST reportarse sin payload ni fallo no manejado y reintentarse de forma acotada.

#### Scenario: API nativa falla durante evaluación periódica
- **WHEN** un puerto falla en el callback del timer
- **THEN** se informa error seguro y queda programada reevaluación sin declarar éxito falso

#### Scenario: Fallo después de una retirada completada
- **WHEN** se retira una vista y después falla el throttling de otra durante el mismo callback
- **THEN** se publica el estado parcial completado y queda un retry; no se repite la retirada como si no hubiese ocurrido
