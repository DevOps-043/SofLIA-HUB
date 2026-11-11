## ADDED Requirements
### Requirement: Colección unificada
Archivos MUST mostrar archivos de la ubicación del usuario, documentos vinculados y evidencias previas en una cuadrícula, con Buscar archivos, Añadir archivo y Vincular Drive en una barra compacta. MUST permitir vista previa dentro de la aplicación y mostrar fallos parciales sin ocultar las otras fuentes.
#### Scenario: Elegir un archivo de Drive
- **WHEN** el usuario pulsa Vincular Drive
- **THEN** se abre un selector interno de su cuenta conectada que permite recorrer carpetas y páginas, y toma el nombre y enlace del proveedor sin formulario manual.
#### Scenario: Solicitar una descarga histórica
- **WHEN** el backend solicita la firma de un archivo histórico de `project-files`
- **THEN** el transporte permite esa ruta en el origen IRIS configurado con sus permisos actuales, retira las cabeceras de Learning y conserva bloqueados otros buckets y rutas de almacenamiento.
### Requirement: Guardar página desde navegador
El navegador MUST permitir guardar la página actual en un proyecto accesible de la organización activa. Páginas web MUST listar lo guardado sin exigir pegar enlaces ni mostrar Buscar archivos y recursos.
Para un marcador explícito del navegador que sólo incluye título y URL saneada, pulsar Guardar MUST ser suficiente: no se muestra confirmación técnica nativa. Esta excepción MUST rechazar textos, adjuntos, metadatos adicionales o URLs sin sanear y MUST conservar la validación main y los controles de acceso de la base. Un rechazo de almacenamiento MUST mostrarse sin datos internos ni afirmar éxito.
Al confirmarse el guardado, el icono de carpeta MUST quedar iluminado con el color de acento y sin mensaje visible de éxito. El destino guardado MUST permanecer disponible como etiqueta accesible y tooltip. El selector, si estaba abierto, MUST cerrarse. Una página distinta MUST NOT heredar la iluminación y los errores MUST conservar su aviso sin marcar éxito.
Si el navegador se abre dentro de un proyecto verificado, MUST usar ese destino automáticamente al pulsar guardar, sin volver a listar proyectos ni pedir que se seleccione uno. Fuera de un proyecto MUST conservar la selección explícita. El listado directo MUST informar el rol efectivo de cada proyecto sin inventar permisos; la escritura MUST mantener su validación en main.
#### Scenario: Navegador del proyecto activo
- **WHEN** se pulsa guardar desde el navegador abierto en un proyecto
- **THEN** se guarda el enlace en ese proyecto, se identifica el destino en el control y no se abre el selector de proyectos.
#### Scenario: Cambio de ámbito
- **WHEN** cambia el usuario, organización o proyecto durante un guardado
- **THEN** el resultado anterior no se presenta como guardado en el nuevo contexto ni se reenvía la operación.
#### Scenario: Seleccionar destino
- **WHEN** se guarda la página actual navegando fuera de un proyecto
- **THEN** se confirma el proyecto seleccionado y se registra su título y URL, sin compartir sesiones ni cookies.
#### Scenario: Resultado incierto al seleccionar destino
- **WHEN** el guardado desde el selector devuelve incertidumbre, requiere revisión o pierde la respuesta de transporte
- **THEN** el selector bloquea nuevos envíos y pide revisar las páginas del proyecto antes de repetir, sin anunciar éxito.
### Requirement: Autorización de almacenamiento desde las bases
IRIS MUST comprobar la identidad y membresía vigente de Learning antes de dar acceso a las autoridades y almacenamiento del proyecto. Un UUID, rol de espejo o clave pública MUST NOT conceder acceso por sí solo. Main MUST enviar la sesión exclusivamente al destino IRIS configurado y rechazar cambios de ámbito antes del envío. Las políticas MUST aislar organizaciones y proyectos y denegar escritura al lector. No se incorpora la API web de Project Hub.
#### Scenario: Sesión o membresía inválida
- **WHEN** la sesión es inválida o Learning ya no informa una membresía activa
- **THEN** IRIS deniega la operación sin escribir evidencias ni documentos ni presentar éxito.
#### Scenario: Sesión válida y proyecto editable
- **WHEN** el usuario guarda una página en un proyecto que puede editar dentro de su organización
- **THEN** IRIS conserva el enlace y permite volver a leerlo, sin diálogo técnico nativo.
