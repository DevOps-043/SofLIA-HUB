## Purpose

Define una política verificable que reduzca CPU y memoria de las superficies web y procesos de Pulse Hub sin degradar la interacción visible ni perder la identidad de las pestañas abiertas.

## ADDED Requirements

### Requirement: Prioridad de recursos por visibilidad
El sistema SHALL permitir ejecución sin throttling únicamente a las superficies web visibles o bajo control activo del agente y MUST habilitar throttling de fondo para las pestañas ocultas.

#### Scenario: Una pestaña visible y dos ocultas
- **WHEN** el navegador está en modo simple con tres pestañas materializadas y una activa
- **THEN** la pestaña activa permanece sin throttling y las otras dos permiten throttling de animaciones y temporizadores

#### Scenario: Dos pestañas visibles
- **WHEN** el usuario usa modo dividido o superpuesto con dos pestañas visibles
- **THEN** ambas superficies visibles permanecen sin throttling y las pestañas restantes permiten throttling

#### Scenario: Ventana anfitriona oculta
- **WHEN** la ventana que contiene una pestaña deja de estar visible o está minimizada
- **THEN** esa pestaña permite throttling aunque conserve su estado lógico

### Requirement: Suspensión adaptativa de pestañas frías
El sistema SHALL conservar vivas las superficies visibles y un conjunto pequeño de pestañas recientes, SHALL suspender por LRU las pestañas ocultas que excedan el periodo de gracia y MUST restaurar una pestaña suspendida desde su última URL al activarla.

#### Scenario: Pestaña fría no protegida
- **WHEN** una pestaña oculta supera el periodo de gracia, no está entre las recientes protegidas y no reproduce/captura medios ni participa en una tarea del agente
- **THEN** el sistema destruye solamente su superficie nativa, conserva la pestaña lógica y la marca como suspendida

#### Scenario: Pestaña con trabajo activo
- **WHEN** una pestaña está visible, cargando, reproduce audio, está siendo capturada, tiene DevTools abierto, vive en una ventana separada visible o es objetivo del agente
- **THEN** el sistema no la suspende por inactividad

#### Scenario: Reactivación de pestaña suspendida
- **WHEN** el usuario activa una pestaña suspendida
- **THEN** el sistema materializa una nueva superficie con la misma identidad y carga su última URL antes de entregarle el foco

### Requirement: Percepción pasiva acotada
El sistema SHALL actualizar la evidencia visual pasiva después de navegación o interacción relevante y MUST dejar de capturar cuando la pestaña queda estable, manteniendo disponible la observación explícita bajo demanda.

#### Scenario: Reposo después de una captura
- **WHEN** concluye una captura pasiva y no ocurre otra navegación o interacción
- **THEN** el sistema no programa capturas periódicas indefinidas

#### Scenario: Solicitud explícita del agente
- **WHEN** una tarea autorizada solicita una observación fresca de la pestaña visible
- **THEN** el sistema captura imagen y DOM en ese momento aunque no exista un muestreo pasivo pendiente

#### Scenario: Percepción pausada
- **WHEN** el usuario pausa la percepción
- **THEN** se cancelan capturas pendientes, se descarta la evidencia almacenada y las solicitudes de percepción devuelven estado pausado sin afirmar contenido nuevo

### Requirement: Diagnóstico reproducible de recursos
El sistema SHALL ofrecer un diagnóstico opt-in que agregue CPU y memoria de los procesos Electron por tipo, sin registrar URLs, contenido, cookies, credenciales ni otros datos sensibles.

#### Scenario: Muestra diagnóstica
- **WHEN** el modo diagnóstico está habilitado y vence su intervalo acotado
- **THEN** el sistema registra RAM total, CPU total, conteo de procesos y desglose por tipo con unidades explícitas

#### Scenario: Diagnóstico deshabilitado
- **WHEN** el modo diagnóstico no está habilitado
- **THEN** el sistema no crea un temporizador de muestreo ni añade trabajo periódico al runtime

### Requirement: Presupuesto medible sin promesas inventadas
El cambio MUST comparar antes y después en un escenario controlado de tres pestañas y SHALL declarar por separado el resultado observado, la variabilidad por sitio/equipo y cualquier meta no comprobada.

#### Scenario: Evidencia de optimización
- **WHEN** se completa la implementación en un host capaz de ejecutar Electron
- **THEN** la evidencia incluye escenario, duración, versión, muestras de CPU/RAM, resultado agregado y limitaciones de la medición
