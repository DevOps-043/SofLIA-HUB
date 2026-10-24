# Paneles ajustables del aula

Fecha: 2026-10-24. Cambio visual local, sin contratos de servidor o medios nuevos.

## Implementado
- Alumno: ancho del chat y reparto de altura transmisión/actividades mediante
  divisiones arrastrables. Abrir una práctica conserva su expansión inicial si
  el usuario todavía no ha definido una altura propia.
- Instructor: ancho de ambos laterales y altura de Escenas frente a vista previa.
- Separador compartido con captura de puntero, límites, flechas, Home/End,
  restauración con doble clic/Enter y cancelación del arrastre con Escape.
- Medición con ResizeObserver y fallback resize; tamaños efectivos se acotan
  cuando cambia el contenedor sin borrar preferencias ni desmontar los paneles.
- El layout móvil conserva pestañas de navegación y oculta separadores de ancho
  cuando solo muestra un panel. El video y las actividades se pueden repartir
  verticalmente también en esa vista.

Tamaños en memoria por vista, sin localStorage, IPC ni peticiones de red. No
afectan la composición o resolución emitida al grupo. El cambio ajusta tamaños;
no reordena ni convierte todos los paneles en ventanas flotantes.

## Verificación
- 7 archivos / 67 pruebas aprobadas: ParticipantStudio, InstructorStudio,
  StudioResizeHandle, StudioProduction, StudioProgram, LearningWorkspace y
  StudioChat. Incluyen límites, puntero ajeno/secundario, cancelación, pérdida
  de captura, restauración, resize de contenedor, liberación de observadores,
  conservación de borradores/práctica y misma identidad DOM de video/canvas.
- Lint incremental: 9 archivos sin deuda nueva. tsc node y diff --check aprobados.
- verify:pr supera controles anteriores a typecheck y se detiene únicamente en
  TS2345 previo de electron/gmail/raw-message.ts:19 (newline ausente de Options).
  No reportó errores nuevos de estos componentes. No se amplió baseline.
- Harness, documentación e inventario aprobados. No se repitió suite general ni
  se inició una videollamada para este ajuste de geometría.

La revisión visual en navegador sigue pendiente por la configuración de Work;
la captura nativa de la tarea anterior también falló por GPU. No se afirma QA
visual ni una reunión real. Revisión dirigida del CSS comprobó los breakpoints,
límites efectivos, nodos estables y desactivación temporal de pointer events del
iframe durante el arrastre. El cambio no se archiva mientras quedan pruebas reales.

Rollback: revertir componentes/CSS del cambio juntos. Solo se pierden preferencias
de tamaño en memoria; no modifica chats, entregas, permisos o estado de sesión.
