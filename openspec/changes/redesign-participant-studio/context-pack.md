# Contexto del cambio
- Objetivo: implementar el diseño aprobado del participante con chat completo, actividades compactas y barra flotante.
- Actor: alumno asignado; instructor conserva controles de producción y moderación.
- Alcance: escenario con pantalla completa/subtítulos, actividades/materiales, un acceso a salas, chat público y Soflia separado, medios reales del SDK.
- No objetivos: cambiar permisos del instructor, inventar correlación de salas audiovisuales o desactivar grabaciones.
- Restricciones: iconografía existente, sin Fuentes/transiciones/banner de grabación; sin autoactivar dispositivos. Sin claves de quiz ni mensajes ajenos en contexto IA.
- Contratos: componentes renderer y mensajes validados del iframe; comandos académicos existentes sin nuevas tablas o IPC.
- Riesgo: confundir captura local con audio de llamada, filtrar contexto a IA, publicar mensajes en sala incorrecta, perder borradores.
- Criterios: una entrada a salas, ningún espacio debajo del chat, entregas confirmadas, fullscreen nativo, subtítulos reales según capacidad, cancelación y no herramientas en Soflia.
- Incertidumbres: captions dependen de cuenta/anfitrión; Meeting limita controles programáticos de cámara. Identidad audiovisual de salas sigue sin correlación.
