# Diseño del estudio

Estado: frontend interactivo implementado y revisado localmente. Fecha: 2026-10-11.

## Decisiones
- El estudio es un componente independiente de la vista del participante. En Hub una lectura de snapshot determina `can_manage`; el renderer no deduce permisos del nombre, correo ni referencia académica. La fixture visual usa un estudio aislado con ejemplos explícitos.
- El chat del aula tiene estado propio, etiquetas Instructor/SofLIA y acciones de moderación locales. Nunca reutiliza la conversación del asistente general.
- Jerarquía de tres columnas: conversación y estadísticas; composición de la transmisión; actividades y material. En espacios reducidos se elige un panel lateral y se conservan las acciones esenciales.
- Pantalla, Cámara y Combinada son modos compactos junto a Vista previa. Las escenas contienen láminas, fuentes de pantalla o medios locales y se eligen desde un banco independiente. Los controles de medios cambian la composición visual sin pedir permisos ni acceder a dispositivos reales.
- El material y los quizzes elegidos solo aportan nombre y tamaño a la lista local; no se leen ni suben. Los medios de las escenas se muestran con URLs de objeto locales y se liberan al quitar o desmontar. Salas y quizzes quedan en estado local. Los relojes se liberan al desmontar.
- La interfaz identifica el estado de diseño; no presenta acciones locales como publicaciones o transmisiones reales.
- La integración futura necesitará autorización en servidor para cada comando, realtime, permisos de medios, selección real de dispositivos y APIs de salas/recursos. No se inventan contratos nuevos en esta fase.

## Verificación
Flujos de chat y comandos, moderación diferenciada del instructor, salas por tamaño/cantidad, quiz, recursos, relojes, audio y escenas. Ambos temas y ancho reducido mediante Computer Use. Typecheck, lint, documentación y compuerta de PR.

## Revisión de densidad y controles
El usuario solicita más altura para el chat, superficies delgadas y campos redondeados. El editor comparte una sola fila con reacción y envío; desaparece el texto decorativo inferior. Se mantienen los contornos verdes en foco y selección con menor intensidad. Las estadísticas son compactas y la barra de medios alinea icono y texto horizontalmente; en móvil conserva las etiquetas accesibles y muestra iconos.

Los campos numéricos comparten botones de ajuste propios. El selector existente de la aplicación se reutiliza para salas y audio, con el portal dentro del diálogo nativo para conservar la capa modal y el teclado. No se agrega una dependencia. Material reúne la creación y selección local de quizzes; los archivos elegidos solo aportan nombre/tamaño, sin parser ni subida. La publicación e importación real de preguntas requieren definir el formato y contrato en la siguiente fase.

## Escenas y visita a salas
El banco permite preparar hasta 12 escenas en memoria para esta sesión. Cada escena tiene nombre, fuente y contenido; las láminas se componen con texto, las pantallas guardan una fuente pendiente de captura real y las imágenes/videos se previsualizan desde un archivo local de hasta 25 MB. Se admiten PNG/JPG/WebP/GIF/AVIF y MP4/WebM, sin SVG ni HTML remoto. Los videos comienzan silenciados y requieren reproducción manual. Cambiar contenido no apaga compartir, cámara ni micrófono. Si se selecciona una escena mientras la vista solo muestra cámara, se abre la composición combinada o Pantalla para mostrarla. Quitar la escena activa elige la primera restante o un estado vacío.

Las salas pertenecen al estudio y son compartidas por Actividades y Grupo. Visitar una sala cambia el contexto del escenario y del chat; el regreso restaura el grupo principal. Se separan los mensajes y borradores locales por ID de sala, manteniendo las métricas generales de la sesión. Quitar o reemplazar salas devuelve al grupo principal. No se simulan participantes con nombre en las salas ni se efectúa traslado/admisión Zoom. Todo este estado desaparece al cerrar el estudio; la persistencia y la transmisión real siguen pendientes.
