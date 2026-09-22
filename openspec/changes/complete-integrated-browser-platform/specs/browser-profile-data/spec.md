## Purpose

Administra perfiles, marcadores, historial e identidad de forma aislada, portable y útil sin exponer secretos a páginas ni agentes.

## ADDED Requirements

### Requirement: Recuperación local de historial y bitácora
Historial y bitácora SHALL conservar copias SQLite consistentes protegidas por el SO y ligadas al archivo. Su recuperación MUST exigir confirmación nativa, perfil/sesión/control vigentes y respaldo compatible; MUST NOT sustituir bases sanas, futuras, ajenas o con transacciones pendientes.

#### Scenario: Recuperar una base dañada
- **WHEN** el titular confirma una revisión no caducada y los archivos revisados no han cambiado
- **THEN** se conserva el original dañado protegido, se aplica de nuevo la retención vigente y se publica una base validada; el historial reconstruye FTS sin reimportar el legado

#### Scenario: Borrado o reducción de retención
- **WHEN** se eliminan visitas o eventos, o se aplica una retención menor
- **THEN** se retiran las copias antiguas antes de borrar filas, y una recuperación posterior no repone las entradas retiradas

#### Scenario: Respaldo no disponible
- **WHEN** falla generar la copia después de guardar correctamente datos
- **THEN** se advierte del fallo de respaldo sin presentar el guardado como fallido ni prometer recuperación sin una copia válida

### Requirement: Recuperación conservadora de memoria derivada
La memoria semántica SHALL conservar un respaldo SQLite vacío protegido por el SO y ligado al archivo del perfil antes de modificar una instantánea válida. MUST NOT recuperar fuentes, vectores ni consentimiento antiguos.

#### Scenario: Índice dañado o ausente con respaldo
- **WHEN** el titular del perfil persistente confirma recuperar memoria desde soporte con gobierno del agente habilitado y control humano vigente
- **THEN** main verifica contexto, bytes y revisión de un solo uso por cinco minutos, conserva el original dañado cifrado y publica un índice vacío desactivado sin consultar fuentes ni proveedor

#### Scenario: Índice incompatible o revisión obsoleta
- **WHEN** el principal está sano, es futuro o ajeno, excede cuotas, tiene sidecars de transacciones pendientes o cambió mientras se revisaba
- **THEN** no se sustituye ni se anuncia recuperación; una escritura normal tampoco reemplaza un payload ilegible o un principal ausente con respaldo

#### Scenario: Escritura posterior a recuperación
- **WHEN** se guarda una nueva instantánea válida después de recuperar memoria
- **THEN** se retiran primero las cuarentenas locales, conservando el respaldo vacío; un fallo parcial no anuncia guardado y no se promete borrado forense

### Requirement: Recuperación restrictiva de ajustes locales
Los stores de permisos, privacidad y política del agente SHALL conservar una generación del principal v1 válido antes de modificarlo, protegida por el SO y ligada a su archivo/perfil. La recuperación MUST ser explícita, no restaurar autoridad retirada ni modificar claves, dispositivos sync o política empresarial.

#### Scenario: Principal ausente o dañado
- **WHEN** el titular del perfil autenticado solicita recuperar uno de estos tres stores con un respaldo compatible
- **THEN** main revisa sin escribir y pide confirmación nativa con cancelar por omisión; sólo publica si siguen vigentes sesión, perfil, ventana, control humano y los bytes revisados, dentro de cinco minutos y una sola vez
- **AND** conserva el respaldo y una copia cifrada del principal dañado; las lecturas activas reciben la proyección restrictiva al completar el commit, sin volver temporalmente a defaults menos restrictivos

#### Scenario: No resucitar permisos revocados
- **WHEN** el respaldo contiene permisos concedidos, privacidad relajada o permisos persistentes del agente
- **THEN** denegaciones siguen denegadas y los demás permisos requieren preguntar, privacidad pasa a estricta sin excepciones y el agente exige nueva autorización en modo estricto, conservando bloqueos y entradas administradas bloqueadas

#### Scenario: Archivo incompatible o revisión obsoleta
- **WHEN** el principal es válido, futuro, inaccesible, no regular o excesivo, el respaldo es ajeno o cambian los archivos/contexto durante la revisión
- **THEN** se rechaza sin reemplazar el principal; la ausencia del principal con respaldo existente tampoco se convierte automáticamente en almacén vacío

#### Scenario: Retirada de permisos y sus copias
- **WHEN** la persona restablece permisos de un sitio o vacía permisos
- **THEN** se advierte que todas las copias locales de recuperación de permisos del perfil se retirarán antes de guardar para no conservar orígenes borrados; un fallo parcial no se anuncia como borrado completado

#### Scenario: Cierre mientras se recupera
- **WHEN** hay una publicación en curso y comienza el drenaje del store
- **THEN** flush espera la cola compartida del archivo; una recuperación cancelada o vencida no publica y no autoriza efectos en otro perfil

### Requirement: Sesión local de bóveda verificada por Windows
El gestor MUST iniciar bloqueado y aceptar únicamente una verificación nativa de Windows vinculada a la ventana principal. El renderer MUST NOT aprobar la autenticación ni recibir PIN, biometría o contraseña del SO. La autorización MUST caducar a los cinco minutos, al bloquear o suspender el equipo y al cambiar de perfil o cerrar la ventana. La falta de Windows Hello/PIN configurado MUST mantener la bóveda bloqueada, sin sustitución por un diálogo de confirmación.

#### Scenario: Autenticación cancelada o recibo vencido
- **WHEN** la persona cancela Windows, vence el plazo o cambia el perfil mientras la verificación está pendiente
- **THEN** ninguna lectura, guardado, relleno, transferencia o recuperación de credenciales queda autorizada
- **AND** una respuesta tardía no desbloquea la nueva sesión

#### Scenario: Bloqueo durante una operación
- **WHEN** se bloquea la bóveda mientras un guardado o transferencia está en revisión
- **THEN** su guarda de autorización falla antes de publicar o confirmar cambios
- **AND** se retiran los observadores de formularios hasta el siguiente desbloqueo explícito

### Requirement: Perfiles aislados
El navegador SHALL soportar perfil autenticado, invitado y privado. Invitado y privado SHALL usar particiones efímeras y eliminar cookies, historial, permisos y credenciales al cerrarse.

#### Scenario: Cerrar perfil privado
- **WHEN** el usuario cierra la última ventana privada
- **THEN** la sesión efímera y sus stores se destruyen sin alterar el perfil autenticado

#### Scenario: Cancelar la salida con la ventana viva
- **WHEN** se aprueba la salida pero una página cancela `beforeunload`
- **THEN** no se purga el perfil ni se pierden cookies o stores; la aplicación puede continuar con esa sesión

#### Scenario: Limpieza con escrituras pendientes
- **WHEN** se cierra realmente una ventana efímera mientras quedan operaciones sobre sus stores
- **THEN** se captura el perfil saliente, se drenan todas sus colas y se bloquean nuevas escrituras; reapertura y salida normal del proceso esperan la purga y la invalidación de cachés sin tocar perfiles autenticados

#### Scenario: Fallo de limpieza al salir
- **WHEN** la limpieza del perfil cerrado falla o supera el plazo de espera
- **THEN** se informa sin rutas ni secretos y se ofrece reintentar, volver a la aplicación o salir sin completar con consentimiento explícito, sin presentar el fallo como limpieza exitosa

#### Scenario: Revocar la cuenta autenticada
- **WHEN** la aplicación cierra sesión mientras el navegador está en privado o invitado
- **THEN** se revoca el destino autenticado y el selector no puede recuperar el perfil de la cuenta anterior

#### Scenario: Confirmar el cambio de perfil
- **WHEN** el usuario elige otro perfil desde el selector
- **THEN** main solicita confirmación nativa con cancelar por omisión antes de cerrar pestañas o purgar; cancelar conserva el estado y una confirmación tardía después de logout no tiene efecto

#### Scenario: Extensión ligada al perfil
- **WHEN** cambia el perfil o la ventana durante selección, copia, carga o guardado de una extensión
- **THEN** se invalida el token, se retira una carga tardía y no se publica ni escribe su registro en otro perfil; volver a la cuenta original no rehabilita la operación

#### Scenario: Extensiones fuera del perfil persistente
- **WHEN** se intenta instalar, restaurar o habilitar una extensión en privado o invitado
- **THEN** se rechaza antes de invocar la carga nativa; el perfil persistente conserva su registro y las cargas permitidas mantienen desactivado el acceso a archivos

### Requirement: Marcadores administrables
El navegador SHALL almacenar marcadores en main por perfil, con carpetas, etiquetas, edición, búsqueda, orden, deduplicación e importación/exportación HTML.

#### Scenario: Migrar marcadores existentes
- **WHEN** se abre un perfil que conserva marcadores legacy en preferencias
- **THEN** se importan una sola vez al store main sin perder entradas válidas

### Requirement: Historial recuperable
El navegador SHALL conservar URLs y visitas como entidades separadas, permitir búsqueda textual, filtros por fecha y dominio, reapertura y borrado por rango con retención configurable.

#### Scenario: Buscar una visita
- **WHEN** el usuario busca por título, dominio o texto de URL
- **THEN** recibe resultados paginados ordenados por relevancia y fecha

#### Scenario: Configurar retención con borrado
- **WHEN** el usuario elige 30, 90, 180 o 365 días y confirma el efecto destructivo
- **THEN** se eliminan las visitas vencidas y el respaldo JSONL completo, se conserva el límite por perfil y se aplica al registrar o consultar actividad

#### Scenario: Retención administrada
- **WHEN** la organización establece un límite de retención
- **THEN** prevalece el plazo más corto entre el límite local y el administrado, y el renderer no permite sustituirlo

#### Scenario: Reapertura selectiva
- **WHEN** el usuario selecciona una de las últimas 25 pestañas cerradas de la sesión
- **THEN** se reabre conservando su grupo, fijación, silencio y orden, sin retirar la entrada si la navegación falla

### Requirement: Restricción efectiva de extensiones por sitio
El navegador SHALL permitir reducir los sitios de una extensión compatible MV3 con storage/scripting intersectando su manifiesto aprobado. La selección MUST representar protocolo y dominio exactos con todos sus puertos, nunca prometer aislamiento por puerto ni cortafuegos de red. Recuperar permisos retirados MUST requerir reinstalación revisada.

#### Scenario: Aplicar una restricción
- **WHEN** el titular autenticado deshabilita la extensión, cierra otras páginas y deja la última en blanco antes de confirmar sitios
- **THEN** main valida perfil, control humano e integridad, limita hosts/scripts/recursos, retira permisos opcionales y publica nueva huella; sólo devuelve metadata

#### Scenario: Sin sitios o con capacidades incompatibles
- **WHEN** la selección está vacía
- **THEN** se retiran accesos declarados a páginas, sin permitir file/incógnito ni registros que recuperen hosts eliminados
- **AND** una extensión con APIs globales fuera del contrato se rechaza, sin ofrecer aislamiento ficticio

#### Scenario: Contexto cambiado o publicación parcial
- **WHEN** cambia sesión/control o falla publicar registro después de modificar manifiesto
- **THEN** no se declara éxito ni se autoriza el estado parcial; habilitar exige huella válida y la recuperación es reinstalación revisada

### Requirement: Gestor de credenciales avanzado
La bóveda SHALL conservar cifrado del sistema y aislamiento por origen, ofrecer guardar o actualizar después de un gesto de autenticación, generar contraseñas fuertes, detectar débiles y reutilizadas, importar/exportar con advertencia y preparar passkeys mediante el proveedor del sistema. SofLIA MUST NOT recibir secretos, valores de autofill ni exportaciones.

#### Scenario: Selección de cuenta WebAuthn del proveedor
- **WHEN** Chromium entrega varias cuentas descubiertas del autenticador para la pestaña principal segura, visible y bajo control humano del perfil autenticado
- **THEN** main ofrece un selector nativo ligado al documento y al sitio; sólo devuelve al callback nativo el identificador elegido, sin persistirlo ni exponerlo por IPC
- **AND** cancelar, navegar, cambiar perfil/control, ocultar la ventana o vencer sesenta segundos cancela una sola vez; no admite selecciones simultáneas ni elección automática

#### Scenario: Límites del proveedor de passkeys
- **WHEN** el sistema o la versión de Electron no permiten completar WebAuthn
- **THEN** no se genera una clave sustituta en JavaScript ni se presenta el desbloqueo de bóveda como autenticación de passkey; las operaciones privadas quedan en Chromium y el proveedor del SO, sin prometer sync o autofill condicional

#### Scenario: Metadata cifrada y migración local
- **WHEN** se abre una bóveda v1 válida o se guarda una nueva instantánea
- **THEN** v2 protege usuario, origen, fechas y secretos dentro de un sobre autenticado ligado al ámbito; migrar conserva identidad y un respaldo cifrado, sin enviar datos al servidor

#### Scenario: Corrupción o versión futura de la bóveda
- **WHEN** falla autenticar o descifrar, el formato no es compatible o una escritura falla
- **THEN** se rechaza sin sobrescribir el original ni devolver una biblioteca vacía; no se restaura un respaldo antiguo de forma automática

#### Scenario: Relleno de credencial
- **WHEN** el usuario elige una credencial del origen actual y supera autenticación cuando corresponda
- **THEN** main rellena el formulario sin devolver la contraseña al renderer o al agente

#### Scenario: Agente solicita un secreto
- **WHEN** una herramienta runtime intenta leer o exportar credenciales
- **THEN** la operación se deniega aunque el agente controle una pestaña autenticada

#### Scenario: Actualización manual de una cuenta
- **WHEN** el usuario guarda una cuenta ya existente o elige actualizarla desde el gestor
- **THEN** main solicita confirmación explícita del reemplazo indicando cuenta y origen, conserva identidad y fecha de creación, y cancelar no escribe

#### Scenario: Guardado sugerido consentido
- **WHEN** la persona desbloquea la bóveda, activa la preferencia del perfil e intenta iniciar sesión mediante clic o Enter confiables en campos principales compatibles, con o sin evento submit
- **THEN** un mundo aislado privado entrega el candidato sólo a main, que lo prepara cifrado y solicita confirmación nativa con cancelar por omisión, sin afirmar que el acceso tuvo éxito

#### Scenario: Aplicación de acceso sin submit
- **WHEN** la página usa un botón de acceso reconocido o Enter en campos principales sin formulario y el gesto es confiable
- **THEN** sólo se ofrece la cuenta si los campos visibles son inequívocos y el destino declarado no cruza de origen; intentos repetidos durante un segundo no duplican candidatos

#### Scenario: Redirección SSO antes de revisar el guardado
- **WHEN** un candidato ya verificado se redirige en la misma pestaña antes de presentar la confirmación nativa
- **THEN** la revisión conserva exclusivamente el origen inicial y lo anuncia; no copia la cuenta al destino ni permite rellenarla allí
- **AND** congela el documento al abrir la revisión, rechaza posteriores navegaciones incluso de ida y vuelta y vence a los sesenta segundos desde el candidato

#### Scenario: Sugerencia no autorizada u obsoleta
- **WHEN** el evento es sintético, proviene de otro marco, el agente controla la página, cambia el perfil, la pestaña, el documento durante la revisión o el consentimiento, o la cuenta ya tiene la misma contraseña
- **THEN** no se guarda ni se envía el secreto al renderer o al agente; el guardado manual continúa disponible si la detección no es compatible

#### Scenario: Guardado manual obsoleto
- **WHEN** cambia el destino, la cuenta activa, la ventana o la bóveda durante la revisión del guardado
- **THEN** se rechaza la revisión y no se guarda el secreto en otro sitio; la UI conserva el origen revisado y no reutiliza la contraseña tras completar o cancelar

#### Scenario: Recuperación explícita de bóveda dañada
- **WHEN** el principal está ausente o contiene corrupción reconocida y existe un respaldo cifrado válido del mismo perfil
- **THEN** main prepara conteos y exige confirmación nativa; conserva una copia cifrada del principal dañado antes del reemplazo, valida huellas y contexto y desactiva el guardado sugerido; versiones futuras, permisos insuficientes y archivos no regulares se rechazan

#### Scenario: Extensión modificada después de instalar
- **WHEN** se restaura o habilita un paquete cuyo inventario no coincide con la huella aprobada al instalar
- **THEN** no se invoca su carga nativa y se informa error recuperable mediante reinstalación explícita; paquetes antiguos sin huella no se aceptan automáticamente

### Requirement: Catálogo de extensiones verificadas
El navegador SHALL ofrecer un catálogo local con editor, fuente y revisión inmutable verificadas contra huellas distribuidas con la aplicación. La instalación y actualización MUST ser explícitas y mantener las restricciones por sitio existentes.

#### Scenario: Carpeta distinta de la revisión oficial
- **WHEN** falta, sobra o cambia un archivo del inventario fijado
- **THEN** la revisión falla antes de instalar; no se confía en hashes o identidad declarados por el paquete

#### Scenario: Actualización revisada
- **WHEN** el titular confirma una actualización con extensión deshabilitada y páginas en blanco
- **THEN** se valida y carga una copia nueva conservando restricciones, se sustituye el registro y sólo después se retira la copia anterior

#### Scenario: Actualización interrumpida o concurrente
- **WHEN** falla la carga o publicación, cambia la instalación revisada o cambia sesión/perfil/control
- **THEN** se rechaza el resultado obsoleto y se conserva la instalación anterior; ningún permiso se restaura automáticamente

### Requirement: Importación controlada
El navegador SHALL importar de forma explícita marcadores, historial y contraseñas desde formatos soportados, mostrando categorías, conteos, conflictos y advertencias antes de escribir.

#### Scenario: Importación parcial
- **WHEN** algunas entradas son inválidas o duplicadas
- **THEN** se importan las válidas y se entrega un resumen sin registrar secretos

#### Scenario: Revisar marcadores HTML antes de escribir
- **WHEN** el usuario selecciona un HTML compatible de hasta 5 MB
- **THEN** main muestra conteos de nuevas entradas, duplicados, conflictos de metadata e inválidas sin mostrar rutas, URLs ni contenido importado; cancelar es la opción predeterminada y no escribe marcadores

#### Scenario: Elegir cómo resolver conflictos de marcadores
- **WHEN** el usuario confirma importar sólo nuevos o actualizar también los conflictos
- **THEN** la primera entrada válida de cada URL prevalece dentro del archivo; los existentes se conservan salvo aprobación explícita para actualizar título, carpeta y etiquetas, manteniendo ID, fecha de creación y posición

#### Scenario: Contexto obsoleto durante la importación
- **WHEN** cambia el perfil, se cierra la ventana, vence la revisión o cambia la biblioteca después de la vista previa
- **THEN** la confirmación anterior no autoriza una escritura nueva; se requiere volver a revisar y no se modifica otro perfil
