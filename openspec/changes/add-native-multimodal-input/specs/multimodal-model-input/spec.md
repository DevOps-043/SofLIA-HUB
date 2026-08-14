## Purpose

Define cómo un turno de SofLIA entrega video, imagen y audio al modelo: qué ruta de transporte se elige según el tamaño del medio, cómo se acota una ventana de video, qué resolución de medios se aplica y qué debe declarar el sistema cuando un medio no puede enviarse.

## ADDED Requirements

### Requirement: Rutas de transporte de medios

El sistema SHALL elegir la ruta de transporte de cada medio según su tamaño y origen, y MUST rechazar de forma explícita un medio que ninguna ruta admita, sin degradarlo silenciosamente a texto ni omitirlo del turno.

#### Scenario: Medio pequeño enviado en línea

- **WHEN** un medio adjunto al turno no supera el presupuesto en línea del proveedor
- **THEN** el sistema lo envía como dato incrustado con su tipo MIME real y no realiza ninguna subida remota

#### Scenario: Medio grande enviado por archivo remoto

- **WHEN** un medio supera el presupuesto en línea pero no el límite de subida del proveedor
- **THEN** el sistema lo sube por la API de archivos, espera a que el proveedor lo declare procesado y envía en el turno la referencia al archivo remoto en lugar del contenido

#### Scenario: Medio direccionable por URI pública

- **WHEN** el medio es un video público accesible por URL que el proveedor puede descargar del lado servidor
- **THEN** el sistema envía la URI del medio sin descargarlo ni subirlo, y registra en el resultado que la ruta usada fue por URI

#### Scenario: Medio que excede todo límite

- **WHEN** un medio supera el límite de subida del proveedor o su tipo MIME no está entre los formatos admitidos
- **THEN** el sistema no envía el medio, informa al usuario el motivo concreto y el límite aplicable, y el turno continúa sin evidencia inventada sobre ese medio

#### Scenario: Tipo MIME ausente o inconsistente

- **WHEN** un medio llega sin tipo MIME o con uno que no corresponde a su contenido real
- **THEN** el sistema determina el tipo por inspección del contenido y, si no logra determinarlo entre los formatos admitidos, aplica el rechazo explícito

### Requirement: Ventana temporal de video

El sistema SHALL acotar todo video enviado a una ventana temporal explícita, MUST no superar la duración máxima configurada por turno y MUST registrar en el resultado de la herramienta la ventana efectivamente enviada.

#### Scenario: Ventana alrededor de la posición de reproducción

- **WHEN** el turno se refiere a un video en reproducción y se conoce su posición actual
- **THEN** el sistema envía una ventana centrada en esa posición, acotada por la duración máxima por turno, y declara el inicio y el fin enviados

#### Scenario: Solicitud sobre el video completo

- **WHEN** el usuario pide analizar el video completo y su duración supera la ventana máxima por turno
- **THEN** el sistema envía la primera ventana admisible, declara explícitamente qué intervalo cubrió y ofrece continuar con los intervalos restantes en turnos posteriores

#### Scenario: Ventana fuera de la duración del medio

- **WHEN** la ventana calculada excede el inicio o el final del medio
- **THEN** el sistema recorta la ventana a los límites reales del medio y no envía desplazamientos negativos ni posteriores a su duración

#### Scenario: Registro de la ventana en el resultado

- **WHEN** un turno envía video
- **THEN** el resultado de la herramienta expuesto al usuario incluye la fuente, el intervalo enviado y la resolución de medios aplicada

### Requirement: Resolución de medios y costo del turno

El sistema SHALL permitir seleccionar la resolución de medios del turno y MUST aplicar una resolución reducida por omisión en entradas de video de duración larga, para que el costo de un turno multimodal permanezca acotado y predecible.

#### Scenario: Resolución reducida por omisión en video largo

- **WHEN** la ventana de video enviada supera el umbral de duración configurado
- **THEN** el sistema aplica la resolución de medios reducida sin intervención del usuario y lo declara en el resultado

#### Scenario: Resolución alta solicitada para detalle visual

- **WHEN** el usuario pide leer texto pequeño, cifras o detalle fino de una imagen o frame
- **THEN** el sistema aplica la resolución de medios alta para ese turno

#### Scenario: Presupuesto de turno excedido

- **WHEN** la combinación de medios del turno supera el presupuesto de tokens configurado
- **THEN** el sistema reduce primero la resolución de medios, luego la ventana temporal, y si aún excede el presupuesto informa al usuario qué medio no pudo incluirse

### Requirement: Ciclo de vida y caducidad del archivo remoto

El sistema SHALL tratar todo archivo subido al proveedor como almacenamiento temporal gobernado, MUST no reutilizar una referencia caducada y MUST informar al usuario que el medio sale del equipo antes de la primera subida de la sesión.

#### Scenario: Consentimiento antes de la primera subida

- **WHEN** un turno requiere subir por primera vez un medio del usuario al proveedor en esta sesión
- **THEN** el sistema informa que el archivo se transfiere y permanece temporalmente en la infraestructura del proveedor, y requiere confirmación explícita antes de subirlo

#### Scenario: Referencia caducada reutilizada

- **WHEN** un turno posterior referencia un archivo remoto cuya vigencia expiró
- **THEN** el sistema detecta la caducidad, vuelve a subir el medio si sigue disponible localmente y, si no lo está, informa que la evidencia ya no existe en lugar de responder sobre ella

#### Scenario: Procesamiento del proveedor no completado

- **WHEN** el proveedor no declara el archivo como procesado dentro del tiempo de espera configurado
- **THEN** el sistema aborta el envío de ese medio, informa el estado alcanzado y no bloquea indefinidamente el turno

#### Scenario: Fallo de subida

- **WHEN** la subida falla por red, credencial o cuota
- **THEN** el sistema informa la causa clasificada sin exponer la clave del proveedor ni rutas locales completas, y el turno continúa sin ese medio

### Requirement: Evidencia declarada y prohibición de descripción no observada

El sistema SHALL exigir que toda afirmación sobre contenido visual o sonoro provenga de un medio efectivamente enviado en el turno, y MUST declarar la ausencia de evidencia cuando la captura o el envío falla.

#### Scenario: Medio no enviado por fallo

- **WHEN** el turno requería evidencia visual o sonora y ningún medio pudo enviarse
- **THEN** la respuesta declara que no dispone de esa evidencia y su causa, y no describe escena, personas, texto ni sonido

#### Scenario: Evidencia parcial

- **WHEN** solo una parte de los medios solicitados pudo enviarse
- **THEN** la respuesta describe únicamente lo que la evidencia enviada permite verificar y enumera lo que quedó fuera
