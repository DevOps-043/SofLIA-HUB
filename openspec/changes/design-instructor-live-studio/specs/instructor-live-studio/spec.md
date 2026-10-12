## ADDED Requirements

### Requirement: Vistas separadas
Hub SHALL mostrar el estudio al instructor autorizado y conservar una vista de participante independiente.

#### Scenario: Permiso confirmado
- **WHEN** el snapshot vigente indica `can_manage`
- **THEN** se muestra el estudio de diseño del instructor
- **AND** sin ese permiso no se muestra el estudio, ni se abre navegador o chat general

### Requirement: Estudio de frontend
El estudio SHALL presentar chat y estadísticas a la izquierda, vista previa central, actividades a la derecha y controles flotantes inferiores.

#### Scenario: Moderación y conversación
- **WHEN** se exploran el chat, sus comandos y controles
- **THEN** el instructor puede escribir incluso si restringe el chat de participantes, distinguir sus mensajes por insignia, habilitar reacciones o SofLIA y simular restricción/bloqueo de usuarios
- **AND** ve métricas y preguntas frecuentes derivadas de los mensajes de ejemplo, separadas del chat general

#### Scenario: Preparar una actividad
- **WHEN** se configuran salas por tamaño o cantidad, un quiz, archivos, lecturas o relojes
- **THEN** el diseño refleja su estado local y ofrece validación de campos y límites
- **AND** no envía recursos ni comandos a la sesión real

#### Scenario: Preparar la transmisión
- **WHEN** se cambian escena, cámara, micrófono, pantalla o selección de audio
- **THEN** la vista previa refleja la selección y conserva acceso a los controles en distintos tamaños
- **AND** no solicita dispositivos ni inicia transmisión real

#### Scenario: Presentación accesible
- **WHEN** se usa tema claro, oscuro, teclado o ancho reducido
- **THEN** las acciones mantienen etiquetas accesibles, foco visible y áreas desplazables sin desbordamiento horizontal

#### Scenario: Densidad visual del estudio
- **WHEN** el instructor revisa el estudio
- **THEN** el chat tiene prioridad vertical sobre las estadísticas, el editor comienza en una sola línea y el encabezado y la barra de medios son delgados
- **AND** los campos redondeados conservan el contorno verde sutil, los números tienen botones propios y los selectores de la aplicación conservan teclado y opciones operables dentro del diálogo
- **AND** Material de la sesión permite crear un quiz o seleccionar un archivo de quiz como metadatos locales, sin subida real ni interpretar sus preguntas

#### Scenario: Visitar una sala preparada
- **WHEN** el instructor prepara salas y abre Grupo
- **THEN** puede visitar cualquiera de esas salas, identificarla en el escenario y el chat, y volver al grupo principal
- **AND** los mensajes locales de cada sala permanecen separados; quitar o reemplazar las salas devuelve al grupo principal
- **AND** no se presenta el cambio de vista como admisión o traslado real en Zoom

#### Scenario: Escenas precargadas
- **WHEN** el instructor prepara láminas, fuentes de pantalla o archivos locales de imagen/video y selecciona una escena
- **THEN** su contenido aparece en la vista previa sin apagar el estado de compartir, cámara o micrófono
- **AND** Pantalla, Cámara y Combinada son modos compactos junto a Vista previa, independientes de las escenas
- **AND** se pueden quitar escenas, se limita la preparación local y se liberan los recursos multimedia al quitar o desmontar
