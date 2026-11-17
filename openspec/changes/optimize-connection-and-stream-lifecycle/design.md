# Diseño

El servicio WhatsApp mantiene su API y carga un módulo runtime sólo al conectar. Un intento compartido se invalida al desconectar o cambiar identidad; el runtime revalida tras importación, filesystem, credenciales y versión antes de crear el socket. La invalidación libera el intento para permitir una nueva conexión; la promesa antigua sólo puede limpiar su propio estado.

Los reintentos pertenecen al servicio mediante un WeakMap: máximo un timer, sin mantener vivo el proceso. Inicio manual, desconexión o cambio de sesión cancelan el reintento. Callbacks de sockets reemplazados se ignoran; promesas de eventos y de guardado de credenciales tienen captura explícita de errores.

La recepción de mensajes y llamadas conserva sus verificaciones y procesa errores por elemento: un rechazo de autorización remota o un elemento malformado se registra y permite continuar con el siguiente. No se reintenta automáticamente una acción potencialmente duplicada ni se relajan permisos al fallar la autorización.

El chat acumula todos los fragmentos pero publica texto intermedio como máximo cada 50 ms, con primer fragmento inmediato y vaciado al terminar el stream. No agrega timers. La actividad de avatar se deduplica por fase/expresión, manteniendo las llamadas de herramientas. Stop, error y generación superada conservan las guardas y resolución final existentes.

Bootstrap renderer descarta ajustes tardíos de otro montaje/ámbito y captura errores para que una dependencia fallida no produzca rechazo global. Reversión por diff, sin migraciones ni cambios de permisos.
