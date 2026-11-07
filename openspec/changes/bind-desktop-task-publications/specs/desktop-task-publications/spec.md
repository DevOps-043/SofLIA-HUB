## Purpose

Impedir que publicaciones y aprendizaje de tareas Desktop se atribuyan a una
cuenta posterior o a un payload sin procedencia comprobada en main.

## ADDED Requirements

### Requirement: Procedencia de tarea vigente
El sistema SHALL conservar identidad/revisión originaria y rechazar resultados
y eventos tras revocación, incluso A/B/A o cancelación de su señal.
#### Scenario: Resultado tardío después de cambiar cuenta
- **WHEN** una tarea anterior termina en una sesión posterior
- **THEN** su resultado no se publica ni se aprende bajo la cuenta posterior

### Requirement: Aprendizaje sin propietario del payload
El sistema SHALL aprender sólo de evento terminal con procedencia privada main,
usando snapshot admitido y revalidación antes de cada escritura.
#### Scenario: Evento forjado o mutado por listener
- **WHEN** llega ownerKey inventado o se altera task/message después de publicar
- **THEN** no se concede propiedad ni se aprende texto distinto del snapshot válido

### Requirement: Contexto de cola y forwarding
El sistema SHALL conservar contexto al despachar colas y verificarlo antes de
forwarding o modificación de marcas de estado por un evento externo.
#### Scenario: Otra tarea libera una plaza
- **WHEN** el finally de un trabajo despacha la siguiente entrada
- **THEN** las publicaciones usan el contexto de esa entrada, sin heredar el del anterior

### Requirement: Compatibilidad y replay
El sistema SHALL conservar DTO/eventos legítimos y evitar guardar dos veces el
mismo evento terminal o reusarlo después de terminar su lease.
#### Scenario: Consumo duplicado o diferido
- **WHEN** el consumidor recibe otra vez el mismo evento o lo reproduce tras terminar
- **THEN** no duplica aprendizaje ni reutiliza autorización vencida
