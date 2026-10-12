## ADDED Requirements

### Requirement: Acompañamiento autónomo
El sistema SHALL desplazar el orbe y mostrar el objetivo autorizado antes de una acción, sin alterar el foco ni interceptar el clic en el objetivo.

#### Scenario: Acción con geometría medida
- **WHEN** Computer Use resuelve un objetivo visible
- **THEN** el orbe se coloca cerca y señala la coordenada o caja real antes de ejecutar

#### Scenario: Cambio de contexto
- **WHEN** cambia el documento, captura, monitor o sesión
- **THEN** se descarta la indicación obsoleta y no se ejecuta por una aprobación tardía

### Requirement: Control y captura
El sistema SHALL permitir pausa y cancelación y entregar capturas de escritorio sin sus propias marcas.

#### Scenario: Pausa antes de actuar
- **WHEN** el usuario pausa la guía
- **THEN** no se inicia la siguiente acción hasta reanudar o cancelar

#### Scenario: Captura y cancelación concurrentes
- **WHEN** termina una captura después de cancelar
- **THEN** no reaparecen marcas ni una ventana que el usuario cerró

### Requirement: Práctica local comprobable
El sistema SHALL orientar por texto visible y avanzar únicamente cuando se comprueba una condición de resultado explícita.

#### Scenario: Resultado aún ausente
- **WHEN** el usuario solicita comprobar y el resultado esperado no está visible
- **THEN** conserva el paso y no declara éxito

### Requirement: Frontera autenticada
El sistema SHALL rechazar emisores ajenos, subframes, payloads inválidos y datos de una sesión anterior.

#### Scenario: Ventana ajena
- **WHEN** otra ventana solicita controles o una práctica
- **THEN** la solicitud se rechaza sin efectos
