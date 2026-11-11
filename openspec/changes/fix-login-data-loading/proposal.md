# Carga de datos al iniciar sesión

## Problema

La consulta inicial de proyectos puede preceder a la publicación y validación de
sesión en main y mostrar IPC_DENIED. La restauración Lia espera una escritura de
perfil y la repite al aceptar la sesión. Los callbacks de auth ejecutan trabajo
asíncrono dentro de la notificación del SDK. El fallo de conversaciones requiere
intervención manual incluso si la conexión se recupera.

## Alcance

Ordenar publicación y lectura inicial sin ampliar permisos; sacar la escritura
de perfil de la ruta crítica; diferir callbacks de auth; recuperar conversaciones
con intentos acotados y conservar un error accionable cuando el fallo persiste.
Los reintentos de proyectos serán acotados y discretos durante recuperación.

La continuación incluye desbloquear la validación TypeScript del compositor
Gmail: declarar de forma precisa su opción `newline`, soportada en runtime pero
ausente de los tipos instalados, conservando CRLF, BCC y las guardas existentes.

## No objetivos y riesgos

No cambiar tablas, credenciales, RLS, canales IPC ni desplegar servicios. No
prometer una reducción de latencia de producción sin medición real. Preservar
los cambios locales de creación de proyectos usados como base de reproducción.
