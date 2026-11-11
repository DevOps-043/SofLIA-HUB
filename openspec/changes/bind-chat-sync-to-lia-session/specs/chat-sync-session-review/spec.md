## Purpose

Conservar las escrituras pendientes del chat y evitar continuarlas o publicarlas
bajo una sesión Lia distinta de la que dio origen a su lote local.

## ADDED Requirements

### Requirement: Sesión coincidente antes de efectos
Una sincronización MUST comprobar que el sujeto observado de la sesión Lia
coincida con el ID solicitado. Falta de sesión o error de revisión MUST impedir
efectos nuevos y conservar los datos pendientes.

#### Scenario: ID sin sesión correspondiente
- **WHEN** se solicita sincronizar un ID ajeno al de la sesión o no hay sesión
- **THEN** no se envían operaciones del lote ni se retiran sus pendientes

### Requirement: Revocación sin reactivación implícita
Un cierre o cambio de identidad observado MUST revocar los lotes anteriores.
Volver a la misma cuenta MUST NOT reactivar esos lotes sin solicitud nueva.
Respuestas revocadas MUST NOT reconocer pendientes ni publicar cache.

#### Scenario: Cambio durante red
- **WHEN** llega una respuesta después de cambiar o cerrar la sesión observada
- **THEN** se conserva la entrada pendiente y no se publica esa respuesta

#### Scenario: Volver a la misma identidad
- **WHEN** la sesión cambia A/B/A mientras un lote A espera
- **THEN** el lote anterior sigue revocado y sólo una solicitud nueva válida puede continuar

### Requirement: Renovación y orden conservados
Renovar sesión o repetir un evento de la misma identidad MUST conservar trabajo
vigente. Lotes pendientes de ciclos distintos MUST NOT fusionarse; las promesas
revocadas MUST resolverse sin perder los datos que no se hayan reconocido.

#### Scenario: Refresh con identidad estable
- **WHEN** el SDK renueva la sesión manteniendo el sujeto
- **THEN** el lote vigente puede terminar y reconocer su contenido sin cambiar permisos

### Requirement: Recurso y estado inicial vigentes
Una lectura inicial tardía MUST NOT sustituir un evento más reciente de sesión.
La revisión MUST liberar su listener al finalizar y un error de limpieza MUST
NOT restaurar trabajo revocado ni bloquear nuevas solicitudes.

#### Scenario: Lectura antigua y cierre posterior
- **WHEN** una lectura inicial devuelve A después de observar cierre de sesión
- **THEN** A no vuelve a habilitar operaciones de ese lote

#### Scenario: Coordinador ocioso
- **WHEN** finalizan las pasadas de una identidad
- **THEN** se libera su suscripción y una solicitud posterior establece otra revisión
