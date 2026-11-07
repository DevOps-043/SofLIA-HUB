## Purpose

Proteger todos los canales nativos Desktop Agent con contratos comprobados,
autorización de fuente y revisión humana vinculada a sus operaciones.

## ADDED Requirements

### Requirement: Fuente y payload autorizados
El sistema SHALL validar fuente Hub/Orbe, marco/documento, revisión de identidad
y argumentos cerrados antes de servicio; revalidará publicación tras esperas.
#### Scenario: Fuente ajena o payload alterado
- **WHEN** llega otra ventana/subframe o argumentos fuera del contrato
- **THEN** se rechaza sin lectura/efecto ni información privada

### Requirement: Revisión nativa de efectos
El sistema SHALL confirmar tareas, entrada, configuración, perfiles, observación,
foco y calibración desde main con el snapshot admitido.
#### Scenario: Cambiar sesión durante diálogo
- **WHEN** la fuente o identidad se revoca antes de aceptar
- **THEN** no se ejecuta la operación aunque el renderer hubiera confirmado

### Requirement: Control disponible y concurrencia acotada
El sistema SHALL acotar trabajos físicos sin impedir abort/stop autorizados
mientras una tarea está pendiente.
#### Scenario: Detener trabajo ocupado
- **WHEN** el usuario autorizado pide abort/stop durante ejecución
- **THEN** el control alcanza servicio sin cola de aprobación ni plaza de tarea

### Requirement: Observación y tareas revocables
El sistema SHALL propagar señal main a tareas y evitar etapas de observación
posteriores a stop, reemplazo o revocación de su lease.
#### Scenario: Modelo devuelve acción tras stop
- **WHEN** una observación detenida recibe resultado tardío
- **THEN** no actúa ni cambia el running de una observación posterior

### Requirement: Teclado sin código arbitrario
El sistema SHALL validar tecla/acorde antes de interpretar o enviar a un driver,
conservando texto literal y aliases admitidos.
#### Scenario: Tecla con fragmento de script
- **WHEN** se proporciona texto que no representa una tecla declarada
- **THEN** se rechaza antes de PowerShell, driver o proceso externo

### Requirement: Configuración confirmada al persistir
El sistema SHALL conservar estado publicado previo cuando falle persistencia,
sin guardar configuración en cwd como fallback.
#### Scenario: Fallo del archivo de configuración
- **WHEN** el guardado o reemplazo falla
- **THEN** no se publica éxito ni config actualizada y se conserva el archivo anterior
