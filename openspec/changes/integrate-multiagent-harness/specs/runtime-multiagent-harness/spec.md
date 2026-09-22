## Purpose

Permitir análisis multiagente supervisado de reuniones con aislamiento de identidad, herramientas acotadas y recuperación observable.

## ADDED Requirements

### Requirement: Análisis con especialistas y límites
El sistema SHALL ejecutar dos especialistas y una síntesis con límites de entrada, salida, llamadas, concurrencia y duración.

#### Scenario: Análisis satisfactorio
- **WHEN** una persona autenticada inicia un análisis
- **THEN** observa estados por especialista y obtiene un borrador con evidencia.

#### Scenario: Cancelación o fallo
- **WHEN** se cancela o falla una etapa
- **THEN** no se inicia síntesis con aportes incompletos y el estado final informa el resultado.

### Requirement: Identidad y herramientas
El sistema SHALL validar propietario, organización y sesión antes de ejecutar herramientas o producir efectos; SHALL negar herramientas fuera del catálogo.

#### Scenario: Sesión revocada
- **WHEN** cambia el usuario o contexto durante una ejecución
- **THEN** se cancela el trabajo y ninguna respuesta tardía permite publicar.

#### Scenario: Herramienta desconocida
- **WHEN** el modelo solicita shell o una herramienta no registrada
- **THEN** se rechaza sin ejecutarla.

### Requirement: Recuperación y confirmación
El sistema SHALL persistir solo con cifrado, recuperar ejecuciones interrumpidas mediante acción humana y vincular la confirmación al borrador exacto.

#### Scenario: Reinicio
- **WHEN** se abre un historial con ejecución previamente activa
- **THEN** se muestra interrumpida y no se repiten escrituras.

#### Scenario: Confirmación caducada o duplicada
- **WHEN** la decisión no coincide con el resultado vigente o ya fue consumida
- **THEN** no se crea una segunda operación.

### Requirement: Acceso desde Meeting Ops
El sistema SHALL ofrecer controles de iniciar, detener, recuperar y revisar mediante una API tipada y restringida a la ventana principal.

#### Scenario: Llamada de frame no autorizado
- **WHEN** otra superficie invoca el canal
- **THEN** se rechaza antes de acceder a datos.
