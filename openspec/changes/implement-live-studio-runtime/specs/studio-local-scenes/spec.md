## ADDED Requirements

### Requirement: RF-SCENE-001 Escenas de producción locales
El instructor SHALL poder crear, seleccionar y quitar escenas sin enviar comandos
scene/select_scene/remove_scene ni subir sus archivos a Learning. Las escenas
SHALL pertenecer al estudio local; los materiales académicos importados pueden
servir de contenido inicial sin convertir el banco de producción en estado remoto.

#### Scenario: Learning no confirma una escena
- **WHEN** el instructor guarda una escena con Learning no disponible para comandos
- **THEN** la escena se crea localmente sin esperar confirmación remota

### Requirement: RF-SCENE-002 Vínculo real a una fuente
Una escena de pantalla SHALL requerir elegir una pantalla, ventana o pestaña real
con el selector propio. El nombre libre no SHALL acreditar una fuente. El vínculo
SHALL ser una concesión efímera opaca ligada a la ventana principal y su actor,
con nombre, tipo y miniatura. La fuente SHALL conservarse al detener/reanudar
Compartir y cambiar de escena. No SHALL buscar otra ventana por nombre ni elegir
otra pantalla si la fuente se cierra. La navegación de la pestaña ya vinculada
SHALL seguir la misma pestaña, sin admitir otro perfil o vista recreada.

#### Scenario: Preparar y volver a compartir
- **WHEN** el instructor vincula una fuente, guarda la escena y pulsa Compartir
- **THEN** se captura esa fuente sin otro selector y se mantiene el vínculo al detener

#### Scenario: Fuente desaparecida
- **WHEN** la fuente vinculada deja de estar disponible
- **THEN** se muestra un error y se ofrece volver a vincular sin capturar otra fuente

### Requirement: RF-SCENE-003 Compartir utiliza la escena ligada
El dock SHALL iniciar y detener la vista local de la fuente seleccionada. La
solicitud nativa del SDK Zoom SHALL reutilizar la fuente ligada a la escena activa.
El inicio remoto SHALL usar el control oficial Compartir del SDK integrado, que
no expone un método público de inicio de pantalla. Cambiar la escena durante una
emisión Zoom SHALL detener la captura anterior y explicar cómo iniciar la nueva;
no SHALL mostrar una escena nueva como si ya se estuviera transmitiendo.

#### Scenario: Selección de otra escena
- **WHEN** se selecciona otra escena de pantalla durante una vista local activa
- **THEN** la nueva fuente reemplaza la anterior y se liberan sus pistas

### Requirement: RNF-SCENE-001 Autorización y limpieza
Los canales de vínculos SHALL aceptar únicamente al frame principal del Hub
autenticado, con payload estricto y IDs de su inventario. Se SHALL limitar a 14
vínculos efímeros (12 escenas más edición/reemplazo), una elección simultánea y
una captura local de pantalla. Quitar, cancelar edición, salir, navegar, cerrar o
cambiar identidad SHALL liberar concesiones, pistas y URLs locales. No SHALL
persistir IDs nativos, miniaturas, capturas ni tokens de consentimiento en Learning.

#### Scenario: Cambio de identidad durante la elección
- **WHEN** cambia el actor antes de terminar el selector
- **THEN** el resultado se descarta y no se crea un vínculo
