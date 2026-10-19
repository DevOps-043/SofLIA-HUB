## Why
El instructor necesita preparar el siguiente contenido sin interrumpir lo que
ve el grupo, y mostrar pantallas de espera, inicio, receso y cierre. Actualmente
las escenas son vistas locales y cambiar fuente detiene la pantalla de la llamada.

## What Changes
- Separar vista previa y salida de programa con acción explícita Pasar a salida.
- Añadir corte, fundido y barrido con duración configurable.
- Añadir una imagen o pantalla intermedia reutilizable entre escenas (500–10000 ms).
- Añadir pantallas editables de espera, inicio, receso y cierre; cuenta regresiva
  opcional sin volver automáticamente a una cámara o pantalla privada.
- Componer láminas, imágenes, videos silenciosos y capturas autorizadas en un
  lienzo continuo. Proyectarlo en una ventana local aislada que la llamada captura
  una sola vez, conservando la pista al cambiar de escena.
- Mantener el modo directo anterior cuando no se prepara salida de programa.

No objetivos: stingers de video importados, cámara virtual, OBS externo, mezcla de audio,
música automática, edición remota de Learning, grabación nueva ni despliegue.

## Capabilities
### New Capabilities
- `studio-program-transitions`: preparación, cambios de programa y pantallas de curso.
- `studio-program-output`: salida local continua y concesión segura para la llamada.
### Modified Capabilities
Ninguna especificación consolidada cambia; se amplía el estudio en desarrollo.

## Impact
Renderer del instructor, compositor canvas, ventana Electron, IPC tipado y
selector de captura existente. Sin dependencias, secretos, tablas ni migraciones
nuevas. El runtime Meeting SDK conserva su control oficial Compartir y su protocolo.
