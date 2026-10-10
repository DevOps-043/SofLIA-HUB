## Purpose

Reducir esperas y trabajo repetido del navegador manteniendo navegación segura,
selección de texto, restauración de overlays y sincronización de los agentes.

## ADDED Requirements

### Requirement: Cierre múltiple sin estados intermedios
Las acciones de cerrar otras pestañas o las situadas a la derecha SHALL
conservar selección e historial y MUST aplicar layout y publicar el cierre solo
al finalizar, sin materializar destinos suspendidos que se van a cerrar.

#### Scenario: Cerrar grupo con destino suspendido
- **WHEN** se cierra un grupo y la pestaña conservada está suspendida
- **THEN** se materializa solo el destino final y no se publican listas parciales;
  los eventos posteriores de carga conservan su progreso y errores

#### Scenario: Limpieza nativa fallida
- **WHEN** falla el cierre de un aviso de la pestaña activa durante el cierre múltiple
- **THEN** se conserva el error, se retira su página y el estado parcial apunta
  únicamente a pestañas existentes

#### Scenario: Reemplazo fallido de la última pestaña
- **WHEN** falla la creación o materialización del reemplazo al cerrar la última pestaña
- **THEN** se retira la página anterior y la selección apunta a una pestaña
  sobreviviente o queda vacía, sin identificadores eliminados

#### Scenario: Cierre de pestaña en pantalla completa
- **WHEN** se cierra la pestaña que puso la ventana en pantalla completa
- **THEN** se restaura el estado previo de la ventana y se aplica solo el layout final

### Requirement: Sugerencias coherentes con la dirección actual
La barra SHALL agrupar las consultas durante escritura continua y MUST mostrar
únicamente resultados del texto vigente, ignorando respuestas tras cerrar.

#### Scenario: Cambio de texto con consulta pendiente
- **WHEN** se edita la dirección mientras hay sugerencias del texto anterior
- **THEN** las anteriores dejan de ser seleccionables inmediatamente y una
  respuesta antigua no reemplaza los resultados vigentes

#### Scenario: Cambio de perfil con la misma consulta
- **WHEN** cambia el perfil sin cambiar el texto de la dirección
- **THEN** las sugerencias del perfil anterior no se muestran ni se pueden elegir

### Requirement: Acuse inmediato de navegación humana
Las operaciones humanas SHALL responder tras validar e iniciar la carga sin
esperar recursos secundarios. El estado MUST continuar publicando carga y errores.

#### Scenario: Recurso secundario lento
- **WHEN** la página incluye un recurso local que tarda 750 ms
- **THEN** el acuse humano no espera ese recurso y se publica la carga en curso

#### Scenario: Agente o consumidor que espera el documento
- **WHEN** un agente solicita navegación antes de interactuar
- **THEN** conserva la espera de carga completa y las guardas de contexto

#### Scenario: Error tardío o perfil reemplazado
- **WHEN** una carga iniciada falla o cambia de perfil/documento
- **THEN** el fallo se publica solo para el destino vigente y nunca altera otro perfil

### Requirement: Geometría sin publicaciones repetidas
El navegador SHALL agrupar avisos de resize por cuadro y MUST omitir el trabajo
repetido cuando la geometría y visibilidad no cambian.

#### Scenario: Viewport idéntico
- **WHEN** se publica cien veces el mismo viewport visible
- **THEN** no se generan cien eventos ni escrituras de sesión adicionales

#### Scenario: Restauración de overlay
- **WHEN** se cierra un panel que ocultó la vista nativa
- **THEN** vuelve a publicarse la geometría y se restaura la vista aunque sus medidas coincidan

### Requirement: Selección sin sondeos por escritura ordinaria
El navegador SHALL conservar selección real en frames y MUST evitar consultas
de selección provocadas únicamente por teclas ordinarias sin rango de texto.

#### Scenario: Escritura normal
- **WHEN** se escribe texto sin seleccionar un fragmento
- **THEN** no se recorre el árbol de frames para leer selecciones vacías

#### Scenario: Selección real y resultado obsoleto
- **WHEN** cambia una selección o termina una consulta después de navegar
- **THEN** se adjunta el fragmento vigente y se ignora el resultado del documento anterior

### Requirement: Vista nativa ligada a la interfaz vigente
El navegador MUST ocultar sus vistas del workspace cuando se recarga o pierde
el renderer principal. SHALL exigir geometría nueva para reabrir, conservar
las ventanas separadas y denegar avisos pendientes sin cambiar decisiones guardadas.

#### Scenario: Recarga con navegador abierto
- **WHEN** se recarga la interfaz mientras la página nativa está visible
- **THEN** el chat nuevo no queda cubierto y reabrir el panel conserva la página

#### Scenario: Tarea o aviso pendiente al perder la interfaz
- **WHEN** se pierde la UI de supervisión o consentimiento
- **THEN** la tarea se detiene conservando su reserva hasta limpieza, sus guardas
  anteriores no reviven con otro viewport y los avisos pendientes se deniegan
