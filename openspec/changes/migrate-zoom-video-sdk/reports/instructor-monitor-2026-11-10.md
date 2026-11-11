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

El instructor inició sesión por el acceso normal y conectó el aula
`79fdbc43-49e9-4ba2-a9aa-17416dcbb015`. El Hub de prueba se ejecutó con
`--use-fake-device-for-media-stream`: se activaron únicamente cámara y audio
sintéticos desde la barra del Hub. El patrón verde apareció dentro del monitor
y el encabezado confirmó «Grabación en curso». No se capturaron dispositivos reales.

La cuenta permitía grabar, pero el arranque automático no comenzó durante el
primer ingreso. El adaptador comprueba el estado a los siete segundos e intenta
iniciar la grabación requerida si Zoom confirma que el usuario es anfitrión y
puede grabar. Comprueba el resultado ocho segundos después y conserva el aviso
de error si no se confirma. Respeta una pausa existente. Tres regresiones adicionales
cubren inicio autorizado, rechazo para participantes y conservación de la pausa;
las doce pruebas del runtime y las 43 pruebas focalizadas pasaron.

La [ejecución 42919931918](https://github.com/DevOps-043/SofLIA-Learning/actions/runs/42919931918)
vinculó una grabación y archivó un trabajo. Learning mostró «Edición 1 · Lista»,
un segmento y «Privada». Su reproductor autenticado cargó un MP4 de 104,48 segundos,
640 × 360, sin error, avanzó durante la reproducción y mostró el mismo patrón
sintético. No se publicó la edición para alumnos. La cobertura sigue pendiente
de revisión, porque el ensayo no representa toda la duración académica programada.

La verificación real cubre ingreso del instructor, medios sintéticos, grabación,
importación y reproducción privada. No acredita una llamada con varios alumnos,
pantalla compartida real ni dispositivos físicos. El importador automático se
ejecuta cada dos horas; este ensayo se disparó manualmente al terminar Zoom.

La revisión adversarial comprobó que la recuperación conserva el rol/capacidad
del proveedor, no reinicia una pausa y no declara éxito al resolver solamente
la solicitud. La integración mantiene la validación del origen, ventana y nonce.
La reversión consiste en retirar los commits del monitor y recuperación del Hub;
no borra grabaciones ni modifica la configuración privada del servidor.
