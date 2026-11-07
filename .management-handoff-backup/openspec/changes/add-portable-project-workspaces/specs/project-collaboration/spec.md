## Purpose

Habilitar colaboración sobre proyecto, tareas y archivos con permisos comprobables por identidad y proveedor, sin compartir rutas privadas ni elevar privilegios desde invitaciones o paquetes.

## ADDED Requirements

### Requirement: Invitación y membresía verificadas
El sistema SHALL permitir invitar colaboradores con rol y aceptación ligada a la identidad correcta; soportará expiración y revocación. Invitados externos SHALL depender de política de organización y acceso acotado al proyecto.

#### Scenario: Colaborador acepta invitación válida
- **WHEN** la identidad destinataria acepta una invitación vigente y permitida
- **THEN** se registra su rol en el proyecto y se comprueba por separado el acceso a archivos

#### Scenario: Otro usuario o un invitado externo no permitido
- **WHEN** una identidad distinta intenta aceptar o la política prohíbe invitados externos
- **THEN** se deniega sin conceder membresía del proyecto ni acceso general al workspace

### Requirement: Intersección de permisos de negocio y archivos
El sistema SHALL exigir tanto permiso de proyecto como permiso efectivo de almacenamiento para archivos compartidos. SHALL mostrar membresía y acceso a archivos como estados distintos y no usar el token del propietario para impersonar al colaborador.

#### Scenario: Miembro sin permiso en Drive o OneDrive
- **WHEN** tiene acceso al proyecto pero no a la raíz compartida
- **THEN** puede usar sólo las capacidades de negocio concedidas y recibe una explicación accionable sobre archivos, sin descargar bytes por una cuenta ajena

#### Scenario: Carpeta compartida sin membresía Soflia
- **WHEN** un usuario puede leer una carpeta del proveedor pero no pertenece al proyecto
- **THEN** no recibe tareas, comentarios o datos del proyecto por esa condición

#### Scenario: Acceso directo por permisos externos conservados
- **WHEN** una persona mantiene acceso directo a una carpeta desde el proveedor aunque no tenga membresía Soflia
- **THEN** Soflia no afirma bloquear ese acceso externo y el manifiesto cotidiano no expone instantáneas de tareas, comentarios o miembros; exportarlas exige revisar contenido, audiencia y destino

### Requirement: Publicación explícita desde proyectos locales
El sistema SHALL conservar los archivos locales privados hasta configurar una raíz compartida o publicar copias seleccionadas y aprobadas en almacenamiento privado autorizado. Una invitación SHALL NOT compartir el disco o toda la carpeta automáticamente.

#### Scenario: Compartir desde una carpeta sólo local
- **WHEN** se añaden colaboradores a un proyecto ubicado únicamente en el PC del creador
- **THEN** se ofrece configurar almacenamiento compartido o publicar copias aprobadas y no se promete acceso remoto al escritorio

### Requirement: Roles y administración sin autoelevación
El sistema SHALL validar roles y exportación/restauración en el servidor; cambiar propietario o raíz compartida requiere capacidad de administración explícita. No se aceptan permisos otorgados por un manifiesto.

#### Scenario: Un miembro cambia una tarea o intenta administrar permisos
- **WHEN** un member autorizado edita trabajo y después intenta otorgarse owner
- **THEN** permite sólo la operación de trabajo concedida y deniega la elevación

### Requirement: Revocación y límites observables
El sistema SHALL impedir nuevas operaciones no autorizadas, invalidar colas al comprobar revocación y distinguir grants propios del proveedor frente a grants preexistentes. SHALL informar que copias descargadas no pueden recuperarse por revocar acceso.

#### Scenario: Revocar colaborador con otra copia local
- **WHEN** se retira al colaborador
- **THEN** cesa el acceso futuro del proyecto, se revocan grants propios cuando sea posible y no se borran silenciosamente sus archivos locales

#### Scenario: Fallo parcial al compartir o revocar en proveedor
- **WHEN** la API del proveedor rechaza el cambio
- **THEN** se muestra qué permiso se cambió y qué queda pendiente sin certificar un éxito completo

### Requirement: Recursos vinculados sin publicación implícita
El sistema SHALL conservar identidad, origen y visibilidad de archivos, webs, chats y equipos asociados. Vincular SHALL NOT mover carpetas, publicar conversaciones privadas, heredar acceso masivo de un equipo ni revelar títulos, previews o contadores de recursos ajenos. Desvincular SHALL conservar el recurso original.

#### Scenario: Asociar un chat privado
- **WHEN** un usuario autorizado vincula su conversación privada
- **THEN** la relación permanece privada y compartir contenido con el proyecto exige revisión separada de audiencia y soporte efectivo de permisos del dominio de chats

#### Scenario: Miembro sin acceso a una conversación vinculada
- **WHEN** otro miembro abre el proyecto sin permiso sobre esa conversación
- **THEN** no recibe su título, preview, mensajes o contribución a contadores privados

#### Scenario: Desvincular una página o conversación
- **WHEN** un usuario con permiso retira la asociación del proyecto
- **THEN** desaparece la relación autorizada y se conserva el recurso en su dominio de origen

#### Scenario: Asignar un equipo al proyecto
- **WHEN** se asocia un equipo de trabajo
- **THEN** se explica la política efectiva y no se conceden privilegios de proyecto, archivos o chats sólo por introducir el ID del equipo

### Requirement: Vista previa segura dentro del proyecto
El sistema SHALL tratar archivos y páginas como contenido no confiable, sin convertirlos en instrucciones ni transportar cookies o credenciales por la asociación. SHALL validar URL/destinos de red y ofrecer vista previa segura en la misma superficie cuando sea posible.

#### Scenario: Web no previsualizable o URL insegura
- **WHEN** una página impide su previsualización o su URL/destino no supera la validación
- **THEN** muestra la limitación o rechazo sin ejecutar scripts, acceder implícitamente a redes privadas ni abrir pestañas/ventanas como fallback automático

### Requirement: Pertenencia durable de chats creados en el proyecto
El sistema SHALL asociar desde la creación todas las conversaciones iniciadas dentro del proyecto, incluidos atajos, tareas y navegador, usando el contexto de actor/organización/proyecto capturado al iniciar. SHALL persistir pertenencia y conversación de forma idempotente y recuperable sin fallback silencioso al chat general. Pertenecer SHALL NOT publicar automáticamente contenido privado ni mover las carpetas Lia existentes.

#### Scenario: Crear y reabrir un chat del proyecto
- **WHEN** un usuario crea un chat desde Nuevo chat y después reinicia la aplicación
- **THEN** el chat sigue asociado al mismo proyecto y aparece sólo en listas autorizadas de ese contexto

#### Scenario: Cambiar de proyecto durante el guardado
- **WHEN** el usuario inicia una conversación en un proyecto y cambia a otro antes de recibir el resultado
- **THEN** el resultado conserva el proyecto de origen y no se inserta en la lista, borrador o selección del proyecto ahora visible

#### Scenario: Falla la asociación o no hay red
- **WHEN** no se puede confirmar la pertenencia de la conversación
- **THEN** conserva la operación y el contexto como pendientes recuperables, sin anunciar guardado completo ni crear un chat general sustituto

#### Scenario: Buscar conversaciones o salir del proyecto
- **WHEN** el usuario busca en el lateral del proyecto o vuelve al espacio general
- **THEN** la búsqueda sólo incluye chats autorizados del proyecto y salir no desvincula ni mueve las conversaciones guardadas
