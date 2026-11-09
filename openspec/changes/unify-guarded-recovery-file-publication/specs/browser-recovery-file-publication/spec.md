## Purpose

Preservar la causa y el estado público de una publicación local de recuperación
cuando fallen también recursos auxiliares de cierre o limpieza.

## ADDED Requirements

### Requirement: Publicación bajo guarda y cierre completo
La publicación MUST comprobar la guarda antes de preparar y antes del efecto
público, y MUST completar escritura, sincronización y cierre antes de publicar.
Un fallo previo MUST conservar el principal anterior. El modo exclusivo MUST
conservar un destino que ya exista.

#### Scenario: Guarda revocada durante preparación
- **WHEN** la guarda deja de ser válida después de preparar el contenido
- **THEN** no se inicia publicación y se conserva el destino anterior

#### Scenario: Fallo exclusivo de cierre
- **WHEN** escritura y sincronización completan pero falla el cierre
- **THEN** se rechaza sin iniciar el efecto público

#### Scenario: Destino exclusivo ocupado
- **WHEN** el destino exclusivo ya existe al publicar
- **THEN** permanece intacto y sólo se intenta limpiar el temporal propio

### Requirement: Precedencia de fallo y propiedad de limpieza
Un fallo secundario de cierre o limpieza MUST NOT sustituir el fallo primario.
Una limpieza fallida tras publicación completada MUST NOT anunciar fallo de
publicación. El sistema MUST informar cierre ambiguo/residuo mediante mensajes
estáticos sin rutas, contenido o errores libres. MUST NOT limpiar un temporal
cuya creación exclusiva falló.

#### Scenario: Escritura y cierre fallidos
- **WHEN** falla escribir y también cerrar el recurso
- **THEN** permanece el error de escritura y se declara el cierre incierto

#### Scenario: Publicación y limpieza fallidas
- **WHEN** falla publicar y también eliminar el temporal propio
- **THEN** permanece el error de publicación y se declara el residuo

#### Scenario: Limpieza fallida después del éxito
- **WHEN** se publicó correctamente pero no se puede retirar el temporal propio
- **THEN** se conserva el éxito y se declara el residuo sin afirmar limpieza completa

#### Scenario: Temporal ocupado
- **WHEN** no se logró crear un temporal exclusivo por preexistencia
- **THEN** se rechaza sin eliminar el archivo que ya existía

### Requirement: Parcialidad coordinada preservada
Un fallo de publicación sync después de crear su marcador MUST conservar el
bloqueo y admitir rollback mediante una nueva revisión válida. Los errores de
borrados deliberados MUST NOT tratarse como limpieza auxiliar tolerable.

#### Scenario: Fallo doble después del marcador
- **WHEN** un archivo sync no se publica y falla limpiar su temporal
- **THEN** se conserva el marcador y el fallo primario; otra revisión permite revertir

#### Scenario: Borrado explícito denegado
- **WHEN** no se puede retirar una copia que debe eliminarse por retención o revocación
- **THEN** la operación solicitada sigue rechazándose

#### Scenario: Finalización y compensación fallidas
- **WHEN** no se puede retirar el marcador sync y tampoco su archivo compensatorio recién creado
- **THEN** permanecen marcador/bloqueo y error de finalización, se declara el residuo y otra revisión puede revertir
