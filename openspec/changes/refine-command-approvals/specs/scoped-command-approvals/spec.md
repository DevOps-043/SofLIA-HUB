## ADDED Requirements

### Requirement: Aprobación local acotada
El chat SHALL ejecutar movimientos reversibles declarados sin modal y SHALL ofrecer Siempre permitir sólo para comandos locales no sensibles, acotando la preferencia al usuario, comando exacto, herramienta y carpeta de trabajo.

#### Scenario: Organizar archivos solicitados
- **WHEN** el agente usa organize_files o batch_move_files
- **THEN** no aparece confirmación de movimiento

#### Scenario: Recordar un comando
- **WHEN** el usuario elige Siempre permitir
- **THEN** repetir el mismo comando y ámbito no pide aprobación, pero otro usuario, comando o carpeta sí

#### Scenario: Cambiar variables del sistema
- **WHEN** el comando modifica variables de entorno o configuración sensible
- **THEN** requiere aprobación única y no ofrece recordar

### Requirement: Organización eficiente y reversible
batch_move_files SHALL admitir clasificación por extensión en el destino dentro del mismo lote y SHALL conservar colisiones y manifiesto reversible.

#### Scenario: Dos fuentes con nombres repetidos
- **WHEN** se mueven documentos de Escritorio y Descargas al destino agrupado
- **THEN** cada fuente se resuelve en un lote y no se sobrescriben archivos homónimos

### Requirement: Cierre del presupuesto
Ambos loops SHALL permitir una respuesta final sin herramientas después de la última tanda autorizada sin ejecutar más acciones ni afirmar éxito sin resultados.

#### Scenario: Última tanda ejecutada
- **WHEN** se alcanza el límite de herramientas
- **THEN** el modelo recibe resultados con herramientas deshabilitadas y su respuesta final se procesa

#### Scenario: El proveedor insiste en herramientas
- **WHEN** el proveedor emite llamadas en el cierre
- **THEN** no se ejecutan y se entrega un mensaje honesto de tarea incompleta
