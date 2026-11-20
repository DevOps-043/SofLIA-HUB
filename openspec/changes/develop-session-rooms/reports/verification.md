# Verificación de salas por actividad

Estado: implementación y verificación locales completas; despliegue y piloto pendientes. Fecha: 2026-11-18.

## Alcance implementado

Hub: panel principal del instructor, preparación por actividad, distribución,
asignaciones, nombres, visitas, cierre explícito y espacio de trabajo del equipo.
Learning: contrato canónico, validación del dominio y respuesta HTTP negociada.
Architect: recepción de metadatos opcionales preparada; su productor no cambia.
No se ejecutaron migraciones, despliegues ni operaciones contra aulas reales.

## Evidencia

- Hub: `npx vitest run` sobre `SessionRooms`, `ParticipantStudio`, `InstructorStudio`,
  `StudioProduction`, `StudioCallBridge`, `session-rooms-domain`, `live-studio-domain`,
  `studio-academic-rooms`, `useStudioSession` y `learning-studio-access`: 100 aprobadas
  en 10 archivos. Tras el aviso de revocación se repitieron las cuatro suites
  afectadas (panel, dominio, bridge y SDK): 28 aprobadas.
- Learning: 24 pruebas focalizadas aprobadas, incluidas proyección, ruta HTTP,
  autorización, preparación y límites existentes.
- Typecheck Hub aprobado también tras los ajustes finales.
- Typecheck de Zoom runtime aprobado tras los cambios finales de asignación.
- Lint incremental final: 27 archivos sin deuda nueva. ESLint Learning dirigido:
  ocho archivos modificados aprobados.
- Arnés: aprobado (25 rutas, 10 skills).
- Gate de PR: primer intento identificó el inventario desactualizado por las pruebas
  nuevas; corregido mediante `npm run docs:inventory:sync`. Segundo intento pasó
  tooling (70 pruebas) y se detuvo por Python ausente en PATH. Se encontró el runtime
  existente 3.12.11 y se repitió con `SOFLIA_TEST_PYTHON` absoluto: **compuerta aprobada**.
  Suite general: 668 archivos aprobados, dos omitidos; 7717 pruebas aprobadas y cinco
  omitidas por las condiciones existentes de la suite. Cobertura validada en 2754
  fuentes: líneas 64 %, sentencias 62.08 %, funciones 58.61 % y ramas 55.32 %.
  La ejecución duró 503.66 s. Los últimos ajustes del aviso de revocación y la guarda
  de preparación SDK se verificaron de nuevo con las suites focalizadas, tipos y lint;
  no se repitió toda la cobertura tras esos ajustes.
- Learning, chequeo general de features: falló por tipos CSS y errores ajenos al
  cambio en el worktree sin `next-env.d.ts` generado. Se preparó un chequeo dirigido
  de los seis archivos productivos con los tipos Next existentes, que detectó dos
  errores de estrechamiento en la proyección; corregidos. El chequeo dirigido de
  contrato, dominio, preparación, proyección, servicio y ruta pasó. La configuración
  temporal se retiró al terminar.
- OpenSpec estricto y enlaces Markdown aprobados. Las copias de contrato/dominio se
  comprobaron con `LEARNING_CHECKOUT` apuntando al worktree canónico y el sincronizador
  en modo `--check`.

## Verificación visual

Fixture local `test/manual/live-studio-runtime/vite.config.mts`, sin credenciales,
usada con instructor y participante simultáneos. Se comprobó apertura por actividad,
entrada a sala, chat, controles inferiores, instrucciones, desplazamiento y temas.
El viewport temporal de 430 × 800 se restauró al terminar.

- [Gestión del instructor](instructor-rooms.jpg).
- [Sala en escritorio](participant-room.jpg).
- [Sala en móvil](participant-room-mobile.jpg).
- [Sala en tema oscuro](participant-room-dark.jpg).

## Revisión independiente

La revisión adversarial encontró recorte del panel, pérdida de acceso a materiales,
duplicación de borradores y una lectura de estado SDK después de mover un usuario.
Todos se corrigieron. La segunda revisión ejecutó 17 pruebas aprobadas y no halló
nuevas regresiones en esos arreglos. Se añadieron casos negativos sobre asignación
y compatibilidad. No se modificaron permisos ni se expusieron herramientas nuevas.
La última revisión SDK confirmó siete pruebas aprobadas y detectó que el proveedor
conserva invitaciones al volver al principal. Se añadió el estado explícito de
recuperación `assignment_revocation`, sin anunciar sincronización exitosa.

## Límites operativos

El audio/video se validó con contratos y SDK simulado; el traslado real requiere
piloto con cuenta Zoom y participantes autorizados. Entregas son personales,
no documentos colaborativos. Architect debe adoptar `collaboration` al producir
el manifiesto. Publicar Learning antes de Hub y conservar lector ampliado en rollback.
Retirar una asignación en Zoom requiere cerrar y reabrir salas si el bridge informa
`assignment_revocation`; el panel lo comunica y no reúne al grupo silenciosamente.

## Entrega recuperable

Rama `codex/develop-session-rooms` en ambos repositorios. El contrato/API Learning
quedó guardado en el commit `e2db1268`. Hub conserva la copia canónica sincronizada,
los paneles, pruebas, especificación y capturas en su worktree homónimo. El worktree
principal del usuario no se modificó ni se integraron sus cambios pendientes.

## Galería de la sala y lateral dividido

El seguimiento coloca a las personas presentes en el centro. La actividad,
los integrantes y las entregas quedan arriba del chat, con desplazamiento
independiente y la barra inferior accesible en las dos vistas móviles.

- Comprobación en navegador local con participante e instructor en la misma sala.
  Entrada, visita y regreso confirmados con la fixture. En 430 × 800 se comprobó
  el selector de sala desde la barra inferior y se restauró el tamaño del navegador.
  Capturas de [participante](room-gallery.jpg), [instructor](room-gallery-instructor.jpg)
  y [lateral en móvil](room-gallery-mobile.jpg).
- Se aprobaron 61 pruebas en seis suites del estudio, salas académicas y puente
  de llamadas. El SDK simulado comprueba cámara apagada, desprendimiento del
  reproductor, exclusión de personas de otra sala y cambios de subsesión. Las
  pruebas de interfaz comprueban que el iframe permanece montado y que solo se
  vuelve visible al coincidir la sala académica y la audiovisual.
- Aprobados tipos de Hub y Zoom runtime, compilación del adaptador de Zoom,
  OpenSpec y lint incremental. La primera ejecución de la compuerta aprobó
  7720 pruebas y detectó dos regresiones en la suite del adaptador de Zoom.
  La paginación ahora se monta solo si existe una segunda página y la fixture
  del adaptador representa la llamada del SDK que informa la subsesión actual.
  La repetición dirigida del adaptador, salas y la interfaz aprobó 34 pruebas.
  La repetición de la compuerta pasó tipos, lint y las etapas anteriores a
  cobertura. El proceso de cobertura se interrumpió al perderse la sesión de
  ejecución, con 471 informes parciales de 670 y sin un resultado consolidado.

Queda pendiente un piloto con sesiones y cámaras reales del proveedor.

## Vistas del panel lateral

- Pasaron 56 pruebas de `SessionRooms`, `ParticipantStudio`, `InstructorStudio`
  y `StudioChat`. Cambiar la vista conserva el marco audiovisual y los borradores
  de chat y práctica. El selector no envía operaciones de sala.
- La fixture local confirmó las cuatro vistas para ambos roles en 1280 × 720 y
  430 × 800. Se comprobaron el ancho completo para video, el filtrado de chat y
  actividad, la ampliación en escritorio y el acceso al micrófono en ventana
  estrecha. La fixture usa datos de ejemplo y simula la llamada.
- Capturas de [actividad ampliada](room-sidebar-activity.jpg) y
  [chat en ventana estrecha](room-sidebar-mobile-chat.jpg).
- Pasaron `typecheck`, `lint:changed`, `harness:validate`, `docs:check` y OpenSpec.
  `verify:pr` llegó a cobertura, donde registró fallos en cinco suites del proceso
  principal antes de interrumpirse sin resultado consolidado. La repetición
  dirigida de esas cinco suites aprobó 71 pruebas.
