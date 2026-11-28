## ADDED Requirements

### Requirement: Permisos locales en el compositor
El chat SHALL ofrecer **Aprobar por mí** y **Acceso completo** desde el menú `+`. Aprobar por mí SHALL evaluar las acciones de bajo riesgo en main y pedir revisión para el resto. Acceso completo SHALL requerir autorización explícita al activarlo y reutilizar ese permiso en las operaciones locales de Computer Use, Desktop Agent y el navegador integrado sin pedir revisión por acción.

#### Scenario: Iniciar una tarea de escritorio
- **WHEN** el chat inicia una tarea de Desktop Agent con Acceso completo vigente
- **THEN** main valida la tarea y la ejecuta con la autorización de la ventana

#### Scenario: Política de navegador
- **WHEN** el navegador solicita acceso del agente a un sitio y el modo Acceso completo está vigente
- **THEN** se autoriza para esa sesión y se respetan los bloqueos configurados, los documentos sensibles y las políticas de la organización

#### Scenario: Revocar la autorización
- **WHEN** el usuario vuelve a Aprobar por mí
- **THEN** main retira la autorización activa y elimina la autorización guardada para esa cuenta en el equipo

#### Scenario: Reiniciar la aplicación
- **WHEN** el usuario vuelve a abrir SofLIA y se autentica con la cuenta que autorizó Acceso completo en ese equipo
- **THEN** main restaura la elección guardada. Cada tarea sigue vinculada a su ventana y sesión autenticada, y otra cuenta conserva su propia elección

#### Scenario: Copia iniciada por el usuario
- **WHEN** la persona copia texto desde el chat
- **THEN** la interfaz usa el portapapeles del documento sin solicitar revisión de Computer Use

#### Scenario: Operación local ordinaria del agente
- **WHEN** Acceso completo está vigente y el agente copia texto o mueve un archivo local sin sobrescribir
- **THEN** main ejecuta la operación validada sin pedir una segunda aprobación

### Requirement: Identidad de mensajes editados
Guardar una edición SHALL actualizar el mensaje con su identidad original y descartar la rama posterior conocida que se regenera. El caché y la sincronización SHALL conservar la revisión y ocultar los mensajes de la rama reemplazada sin borrar registros ajenos al turno.

#### Scenario: Recarga con mensajes anteriores
- **WHEN** la sincronización devuelve una versión vieja del mensaje editado o mensajes de su rama anterior
- **THEN** la interfaz muestra una sola copia con el texto editado y conserva otros mensajes que no pertenecían al reemplazo

#### Scenario: Reintentar un mensaje sin respuesta
- **WHEN** el usuario selecciona Enviar desde el editor del último mensaje, que quedó sin respuesta y sin un turno activo
- **THEN** el chat ejecuta un nuevo intento con el mismo mensaje aunque su texto no haya cambiado

### Requirement: Navegación y descargas verificables
El harness SHALL abrir y navegar en la pestaña integrada aunque el panel todavía esté cerrado. SHALL comprobar el estado de una descarga con el registro del navegador antes de tratarla como completa.

#### Scenario: DOM disponible sin captura visual
- **WHEN** la pestaña visible carga y la captura visual está vacía o no se puede obtener
- **THEN** el controlador determinista puede leer el DOM autorizado y seguir por referencias. Si la lectura falla, el chat recibe la etapa y el motivo, y conserva el resultado de la navegación

#### Scenario: Enlace de descarga fuera de la vista
- **WHEN** el agente pide revelar un enlace por su etiqueta o ruta en la página activa
- **THEN** se busca con límites dentro de la página y, si coincide un enlace renderizado, se desplaza hasta él y se devuelve una referencia DOM actual. El desplazamiento aplica la política de interacción del sitio. Una referencia anterior nunca debe identificar otro nodo por ocupar su posición en la lista

#### Scenario: Abrir la primera página de una tarea
- **WHEN** el chat navega a un destino autorizado con el panel cerrado
- **THEN** abre el panel, conserva el destino y devuelve una observación de la pestaña o un fallo explícito

#### Scenario: Reenviar un mensaje editado que abre el navegador
- **WHEN** el turno vigente abre el navegador integrado y el chat pasa al panel lateral
- **THEN** el mismo turno sigue en curso y publica el resultado o el error en la misma conversación

#### Scenario: Transferencia en curso o interrumpida
- **WHEN** el navegador aún está descargando un archivo o lo marca como interrumpido
- **THEN** el resultado conserva el estado real y sólo incluye el destino final tras completarse

#### Scenario: El enlace oficial de descarga abre otra pestaña
- **WHEN** un clic del navegador abre una URL HTTP(S) en una nueva pestaña integrada
- **THEN** la navegación conserva la referencia de origen y la política de privacidad entregadas por Chromium. Se siguen aplicando las reglas de navegación y descarga

#### Scenario: Clic sin transferencia confirmada
- **WHEN** el agente solicita esperar el comienzo de una descarga tras un clic
- **THEN** el clic se ejecuta una vez. El agente recibe las transferencias nuevas observadas o un estado explícito de espera agotada y puede examinar la página de resultado antes de decidir cómo continuar

#### Scenario: Cierre de la indicación de un control DOM
- **WHEN** el clic o la escritura terminan o detectan un control inválido
- **THEN** se retira su indicación visual sin cerrar una indicación posterior de otra tarea
