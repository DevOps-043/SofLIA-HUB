# Monitor integrado del instructor

El iframe Video SDK se montaba en una columna paralela al monitor. Dibujaba su
propia barra de botones y abría allí el video. Ahora el iframe audiovisual
permanece montado dentro del monitor de escenas. Los modos Pantalla, Cámara y
Combinada cambian la presentación sin reiniciar la llamada. La barra inferior
controla los medios y el encabezado recibe el estado de grabación del SDK.

El mensaje de cambio de vista se valida después de comprobar el origen,
la ventana y el identificador del canal. Compartir conserva el selector
autorizado de Electron y los vínculos existentes a la escena o al programa.
El adaptador de Meeting SDK conserva sus controles específicos.

La verificación focalizada pasó 40 pruebas, incluidos los modos del monitor,
la persistencia del iframe al cambiarlos, la barra única y el rechazo de
mensajes de otro origen. Pasaron TypeScript, lint incremental y los enlaces
de documentación. El runtime compiló y el smoke nativo confirmó su origen
aislado y la carga de assets. El gate de PR avanzó hasta las pruebas Python,
que requieren un intérprete 3.12 ausente en este equipo.

El Hub compilado abrió el acceso normal. La prueba de conexión con medios
sintéticos y la comprobación del MP4 en el bucket privado quedan pendientes
de una sesión autenticada del instructor.
