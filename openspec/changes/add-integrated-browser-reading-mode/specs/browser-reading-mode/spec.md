## Purpose

Proporcionar una experiencia de lectura enfocada, accesible y privada para contenido de la pestaña activa, con narración sincronizada cuando la página exponga rangos visuales fiables.

## ADDED Requirements

### Requirement: Apertura explícita desde contenido legible
El sistema SHALL permitir abrir el modo lectura desde texto seleccionado, desde el menú contextual de una página o desde un control visible del navegador. La detección de un documento SHALL habilitar la acción, pero MUST NOT abrir el lector ni enviar contenido a un proveedor externo sin una acción del usuario.

#### Scenario: Texto seleccionado
- **WHEN** el usuario selecciona texto y elige “Abrir en modo lectura”
- **THEN** el lector abre únicamente ese texto y conserva la URL y el título como procedencia

#### Scenario: Documento detectado
- **WHEN** la pestaña activa contiene un documento o una página con contenido legible
- **THEN** el navegador muestra una acción de modo lectura disponible sin interrumpir la navegación

#### Scenario: Solicitud contextual obsoleta
- **WHEN** el usuario cambia de pestaña antes de que se prepare una solicitud contextual
- **THEN** el sistema rechaza la solicitud obsoleta y no mezcla contenido entre pestañas

### Requirement: Extracción segura y semántica
El sistema SHALL extraer contenido visible de la pestaña activa en bloques semánticos con título, idioma y procedencia. MUST excluir contraseñas, valores de formularios, texto editable genérico, controles, scripts, estilos y frames de origen inaccesible, y SHALL aplicar límites de tamaño y tiempo. MAY leer el lienzo documental conocido de Google Docs únicamente tras la apertura explícita del lector.

Para Google Docs, el sistema SHALL priorizar la selección explícita y, al leer el documento completo, SHALL usar la sesión autenticada de Electron para obtener su exportación textual. MAY usar el árbol de accesibilidad de Chromium como respaldo temporal. MUST NOT degradar al DOM general de la interfaz si ninguna vía entrega contenido documental.

#### Scenario: Artículo o documento compatible
- **WHEN** el usuario abre el modo lectura sin una selección explícita
- **THEN** el sistema presenta encabezados, párrafos y listas en orden de lectura, sin navegación ni controles de la página

#### Scenario: Contenido sensible o editable
- **WHEN** la página contiene contraseñas, campos de formulario o un editor activo
- **THEN** los valores de esos elementos no aparecen en el contenido preparado, salvo el cuerpo documental explícito de Google Docs que el usuario eligió leer

#### Scenario: Página sin contenido legible
- **WHEN** no se puede obtener texto suficiente de la pestaña activa
- **THEN** el lector muestra un error recuperable y no inventa ni sustituye el contenido

#### Scenario: Google Docs no expone el documento
- **WHEN** fallan la exportación autenticada y el árbol de accesibilidad
- **THEN** el lector informa el problema y no narra menús, pestañas ni barras laterales como si fueran el documento

### Requirement: Reproductor flotante y reversible sobre el documento
El sistema SHALL mantener visible la página original y mostrar únicamente una cápsula flotante, redondeada, accesible y responsive sobre la selección o el primer bloque narrable. MUST NOT reservar una fila, desplazar el viewport ni cubrir el documento completo. SHALL ofrecer reproducción, pausa, detención, reducción y aumento de velocidad, cierre y un asa para moverla libremente dentro del viewport. Al cerrar, SHALL conservar la misma pestaña, URL, sesión y posición del workspace sin recargar la página.

#### Scenario: Apertura y cierre
- **WHEN** el usuario abre y posteriormente cierra el modo lectura
- **THEN** el reproductor desaparece y el navegador conserva la misma sesión sin una navegación adicional

#### Scenario: Documento con imágenes o gráficas
- **WHEN** el usuario reproduce una selección dentro de un documento visual
- **THEN** las imágenes, gráficas, controles y desplazamiento de la página permanecen visibles y utilizables

#### Scenario: Selección próxima a un borde
- **WHEN** el texto seleccionado está cerca de un borde del viewport
- **THEN** la cápsula se reposiciona dentro del área visible sin alterar el layout de la página

#### Scenario: Reubicación manual
- **WHEN** el usuario arrastra la cápsula desde su asa
- **THEN** la cápsula sigue el puntero, permanece completamente dentro del viewport y deja de saltar de vuelta a la selección durante esa sesión

#### Scenario: Página que exige Trusted Types
- **WHEN** la página activa bloquea asignaciones HTML dinámicas mediante Trusted Types
- **THEN** la cápsula se construye con APIs DOM seguras, se muestra sin violar la política y no genera errores de consola atribuibles al lector

### Requirement: Narración ElevenLabs bajo demanda
El sistema SHALL sintetizar la lectura con ElevenLabs únicamente tras una acción explícita. La credencial MUST permanecer en Electron main; el renderer MUST recibir solo audio, marcas temporales y errores saneados. El sistema SHALL limitar texto, concurrencia, memoria y tiempo de cada solicitud, y SHALL permitir cancelarla.

#### Scenario: Narración configurada
- **WHEN** el usuario inicia la reproducción y ElevenLabs está configurado
- **THEN** el sistema genera y reproduce segmentos de audio en orden sin bloquear el navegador

#### Scenario: Documento largo
- **WHEN** el contenido requiere varios segmentos
- **THEN** un microlote inicial de una o dos frases se reproduce tan pronto está listo y el sistema prepara como máximo dos lotes posteriores mientras el usuario escucha, sin esperar a sintetizar el documento completo

#### Scenario: Proveedor lento o detenido
- **WHEN** ElevenLabs no entrega el lote dentro del presupuesto configurado
- **THEN** el sistema cancela esa solicitud, deja de mostrar un estado de carga indefinido y presenta un error recuperable sin reintentos automáticos que consuman cuota

#### Scenario: Configuración ausente
- **WHEN** no existe una clave o voz válida de ElevenLabs
- **THEN** el lector informa cómo habilitar la narración sin exponer valores ni degradar silenciosamente a otro proveedor

#### Scenario: Voz no disponible para la clave
- **WHEN** ElevenLabs responde `voice_not_found`, `voice_access_denied` o HTTP 404 al sintetizar
- **THEN** el lector explica que `ELEVENLABS_VOICE_ID` debe pertenecer al mismo workspace accesible para `ELEVENLABS_API_KEY`, no repite la solicitud y no cambia silenciosamente a otra voz

#### Scenario: Cierre durante síntesis
- **WHEN** el usuario cierra el lector o detiene la reproducción durante una solicitud
- **THEN** el sistema cancela el trabajo pendiente, detiene el audio y libera los recursos asociados

### Requirement: Seguimiento sincronizado en la página original
El sistema SHALL utilizar las marcas temporales devueltas por el proveedor para subrayar la palabra o fragmento correspondiente dentro del DOM original, sin editar ni persistir el documento. El usuario SHALL poder pausar, reanudar, desplazarse por el progreso y reducir o aumentar la velocidad de reproducción.

#### Scenario: Audio en reproducción
- **WHEN** avanza el audio
- **THEN** la página actualiza el subrayado temporal al fragmento correspondiente y lo mantiene visible cuando existe un rango DOM compatible

#### Scenario: Salto de reproducción
- **WHEN** el usuario mueve el control de progreso o selecciona un fragmento narrable
- **THEN** el audio y el resaltado se reposicionan de forma coherente

#### Scenario: DOM modificado o contenido opaco
- **WHEN** la página ya no permite relacionar el rango narrado con un nodo DOM visible
- **THEN** la reproducción continúa, el sistema no modifica el documento y el resaltado se degrada sin bloquear la navegación

#### Scenario: Google Docs usa lienzo virtual
- **WHEN** la lectura procede de una exportación o del árbol de accesibilidad sin rango DOM estable
- **THEN** la narración continúa sin buscar coincidencias en la interfaz ni subrayar controles ajenos al documento, y la cápsula subraya el token original que se está pronunciando

#### Scenario: Pronunciación de marca y decimales
- **WHEN** un fragmento español contiene `SofLIA` o un decimal como `5.12`
- **THEN** la voz pronuncia “Soflía” y “cinco punto doce”, mientras las marcas temporales siguen apuntando a los caracteres originales

#### Scenario: Continuidad entre microlotes
- **WHEN** una oración se divide entre dos solicitudes de voz
- **THEN** el proveedor recibe contexto anterior y posterior acotado sin duplicarlo en el audio ni alterar los offsets del segmento

#### Scenario: Detención o cierre
- **WHEN** el usuario detiene la narración, cierra el reproductor o cambia de documento
- **THEN** el sistema elimina el resaltado temporal y libera la sesión sin recargar la página

### Requirement: Privacidad y ciclo de vida acotado
El sistema MUST NOT persistir texto, audio ni marcas temporales. Los buffers generados SHALL permanecer únicamente durante la reproducción necesaria, SHALL liberarse al detener, expirar o cerrar la aplicación y MUST NOT incluirse en telemetría o logs. El renderer y preload MUST NOT exponer una operación de descarga del audio.

#### Scenario: Expiración de audio
- **WHEN** un audio supera el tiempo o presupuesto de caché
- **THEN** el sistema lo elimina de memoria y solicita regenerarlo antes de volver a reproducirlo
