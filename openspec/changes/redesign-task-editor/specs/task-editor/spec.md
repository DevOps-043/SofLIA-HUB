## ADDED Requirements

### Requirement: Editor modal de tareas
El sistema SHALL abrir creación y detalle en una ventana modal sin desplazar el tablero, con planificación y recursos vinculados.

#### Scenario: Crear con planificación y recursos
- **WHEN** un integrante editable guarda título, inicio, fecha límite y enlaces válidos
- **THEN** se persisten en la misma tarea y la ventana cierra sólo tras éxito confirmado

#### Scenario: Fase sin configuración previa
- **WHEN** un administrador del equipo guarda una tarea con una fase ausente
- **THEN** la escritura confirmada reutiliza o materializa esa fase sin inventar IDs en el renderer

#### Scenario: Usuario sin administración del equipo
- **WHEN** un integrante sin administración intenta crear una fase ausente
- **THEN** el backend rechaza la operación sin escribir estados ni tarea

#### Scenario: Entrada inválida o resultado incierto
- **WHEN** hay fechas invertidas, URL no HTTP(S) o resultado incierto
- **THEN** el borrador permanece visible y se informa el motivo; la incertidumbre bloquea la repetición
