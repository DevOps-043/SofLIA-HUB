## Purpose

Permitir al usuario borrar los datos que el navegador integrado acumuló en su perfil, con el alcance de un navegador de escritorio y sin ambigüedad sobre qué se borró realmente.

## ADDED Requirements

### Requirement: Selección explícita de categorías
El sistema SHALL ofrecer las categorías historial, cookies y datos de sitios, archivos en caché, contraseñas guardadas y permisos por sitio. MUST NOT borrar marcadores ni extensiones. MUST NOT borrar nada cuando no haya ninguna categoría marcada.

#### Scenario: Selección inicial
- **WHEN** el usuario abre la pestaña de privacidad del navegador
- **THEN** vienen marcadas historial, cookies y caché, y contraseñas y permisos vienen sin marcar

#### Scenario: Sin categorías marcadas
- **WHEN** el usuario desmarca todas las categorías
- **THEN** la acción de borrado queda deshabilitada y ninguna llamada llega a main

#### Scenario: Marcadores y extensiones intactos
- **WHEN** el usuario borra todas las categorías disponibles
- **THEN** sus marcadores y sus extensiones instaladas siguen presentes

### Requirement: Alcance real del intervalo declarado
El sistema SHALL ofrecer un intervalo de tiempo y SHALL aplicarlo de forma exacta al historial. Para las categorías que no pueden acotarse por fecha, el sistema SHALL borrarlas por completo y SHALL declararlo tanto antes de borrar como en el resumen posterior. MUST NOT presentar un borrado completo como si respetara el intervalo.

#### Scenario: Intervalo aplicado al historial
- **WHEN** el usuario elige un intervalo y borra el historial
- **THEN** se quitan solo las visitas posteriores al inicio del intervalo y las anteriores se conservan

#### Scenario: Intervalo sobre cookies o caché
- **WHEN** el usuario elige un intervalo distinto de "desde siempre" y marca cookies o caché
- **THEN** la interfaz advierte que esas categorías se borran completas y el resumen lo repite

#### Scenario: Intervalo "desde siempre"
- **WHEN** el usuario elige "desde siempre"
- **THEN** no se muestra ninguna advertencia de alcance, porque no hay discrepancia que declarar

#### Scenario: Solo historial con intervalo
- **WHEN** el usuario elige un intervalo y marca únicamente el historial
- **THEN** no se muestra advertencia de alcance

### Requirement: Confirmación previa a una operación destructiva
El sistema SHALL exigir una confirmación explícita del usuario antes de borrar. La confirmación SHALL declarar qué categorías y qué intervalo se aplicarán. MUST NOT iniciar el borrado con la sola apertura del panel ni con el cambio de una casilla.

#### Scenario: Confirmación pendiente
- **WHEN** el usuario pulsa borrar
- **THEN** aparece una confirmación y no se ha borrado nada todavía

#### Scenario: Confirmación cancelada
- **WHEN** el usuario cancela la confirmación
- **THEN** no se borra nada y la selección se conserva

### Requirement: Borrado acotado al perfil activo
El sistema SHALL resolver la partición y los archivos del perfil del usuario con sesión activa. MUST NOT borrar datos del perfil de otra cuenta. El borrado MUST NOT cerrar ni recargar las pestañas abiertas.

#### Scenario: Otra cuenta intacta
- **WHEN** el usuario borra todos sus datos de navegación
- **THEN** el perfil de otra cuenta conserva sus cookies, historial, contraseñas y permisos

#### Scenario: Pestañas abiertas
- **WHEN** el borrado termina
- **THEN** las pestañas abiertas siguen abiertas en la misma dirección

### Requirement: Resumen verificable y fallo aislado
El sistema SHALL devolver un resultado por categoría indicando si se borró, cuántos elementos se quitaron cuando la categoría puede contarlos, si se ignoró el intervalo y el motivo del fallo cuando lo hubo. El fallo de una categoría MUST NOT impedir el borrado de las demás. Los mensajes de error devueltos al renderer MUST estar saneados.

#### Scenario: Resumen con conteo
- **WHEN** se borran historial, contraseñas o permisos
- **THEN** el resumen indica cuántos elementos se quitaron en cada uno

#### Scenario: Categoría sin conteo disponible
- **WHEN** se borran cookies o caché
- **THEN** el resumen las declara borradas sin inventar una cifra

#### Scenario: Fallo de una categoría
- **WHEN** una categoría falla durante el borrado
- **THEN** el resumen la marca como no borrada con su motivo y las demás categorías sí se borran

### Requirement: Contrato IPC y ausencia de acceso del agente
El sistema SHALL exponer el borrado mediante un canal dedicado con servicio en main, handler, entrada en la allowlist del preload y wrapper tipado del renderer. El handler SHALL validar categorías e intervalo antes de ejecutar cualquier borrado y SHALL rechazar a un emisor distinto del renderer principal. La operación MUST NOT formar parte del catálogo de herramientas de ningún agente runtime.

#### Scenario: Payload inválido
- **WHEN** el canal recibe una categoría desconocida, un intervalo desconocido o una lista vacía
- **THEN** la solicitud se rechaza con un error saneado y no se borra nada

#### Scenario: Emisor no autorizado
- **WHEN** el canal se invoca desde un emisor distinto del renderer principal
- **THEN** la solicitud se rechaza y no se borra nada

#### Scenario: Agente sin acceso
- **WHEN** un agente runtime resuelve su catálogo de herramientas
- **THEN** el borrado de datos de navegación no aparece entre ellas
