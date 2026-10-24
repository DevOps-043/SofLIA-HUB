# Reacciones sobre video y espera de chat

Fecha: 2026-10-24. Implementado en Hub y preparación local de Learning.

## Resultado
Las reacciones son eventos separados de cinco segundos, sin mensajes ni métricas
de chat. Ambos paneles muestran eventos de la sala actual. El picker del chat
tampoco inserta emojis en el borrador. Se respetan permiso de reacciones y bloqueo
de acceso; cerrar el chat no deshabilita las reacciones por sí solo. Cadencia de
un segundo, seis emojis permitidos, cien eventos retenidos y veinticuatro visibles.

El instructor configura y aplica 0–300 segundos entre mensajes de participantes;
0 desactiva, valor inicial 0. Alumno ve cuenta regresiva sin perder borrador.
La marca es por usuario/sesión y no depende del historial ni de la sala. Se poda
al procesar comandos tras cinco minutos y solo se proyecta al propio actor.
Instructor exento de espera de mensajes. La solicitud de palabra sigue siendo
un mensaje y por ello comparte esa espera.
La fixture visual arranca con cinco segundos para facilitar la prueba del usuario;
es una configuración exclusiva del ejemplo que el instructor puede modificar.

Learning añade validación de dominio y de RPC bajo bloqueo/CAS de sesión, hora
de base de datos e idempotencia. HTTP 429 se conserva como rate_limited y no se
reintenta como fallo de red. No hay nuevas tablas ni permisos públicos. Migración:
20261024180000_live_studio_participation.sql. No ejecutada en remoto.

## Verificación
- Hub: 48 pruebas aprobadas en cinco archivos focalizados (aula/chat/dominio/
  acceso/suscripción), y 13 pruebas de frontera HTTP aprobadas. Casos: reacción
  fuera del chat, sala ajena, expiración, permiso, ráfaga, intervalo, instructor
  exento, reloj, borrador, historial expulsado y ausencia de retry ante 429.
- Learning: 21 archivos y 133 pruebas del módulo live aprobados, incluyendo SQL
  reentrante, roles denegados, CAS concurrente, deduplicación, hora de servidor,
  payload con ledger/intervalo manipulado, aislamiento y formato legacy negociado.
- Ensayo HTTP/SSE localhost:4321 aprobado con reacción sin post e intervalo que
  rechaza el segundo mensaje. También conserva pruebas de salas/entregas/quiz/
  materiales. Moderación/intervalo restaurados al terminar. Solo datos de ejemplo.
- Compilación Zoom y smoke de origen aislado aprobados. No reunión real.
- Tipos estrictos del contrato/dominio Learning aprobados; compilador node de
  Hub aprobado. Lint incremental de Hub sin deuda nueva; harness/docs aprobados.
- verify:pr se detiene en TS2345 previo de electron/gmail/raw-message.ts:19
  (newline no existe en Options). La primera comprobación de tipos en paralelo
  con npm ci del SDK observó temporalmente módulos ausentes; al repetir el gate
  tras el build solo permanece Gmail. No se alteró baseline.
- Suite completa Hub: 5746 pruebas aprobadas, 5 omitidas y 1 fallo de timeout en
  PresentationWorkspacePanel, fuera del cambio. Su archivo completo se repitió
  aislado: 26/26 aprobadas. No se declara suite completamente verde.
- ESLint de Learning bloqueado por configuración existente que no encuentra
  @typescript-eslint/recommended. No se modificó su configuración/dependencias.

## Revisión y rollout
La revisión independiente no encontró fugas de sala/ledger ni saltos de cadencia,
y detectó incompatibilidad de snapshots estrictos antiguos. Corregido mediante
participation_version:1 y prueba de ambas respuestas. La segunda revisión no se
pudo ejecutar por límite de uso del revisor; la corrección tiene pruebas directas.

Publicar migración y API compatibles de Learning antes de Hub. Los Hub antiguos
reciben su forma anterior. Mantener la unión Meeting/Video existente en Hub no
activa proveedor en el servidor. No se configuraron secretos ni se publicaron
cambios. Pendiente ensayo real/QA visual; navegador deshabilitado en Work.

Rollback: desactivar intervalo (0), retirar UI/API nuevas coordinadamente y
conservar estado; restaurar RPC anterior solo después de retirar clientes nuevos.
No borrar tablas ni datos como reversión. La fixture se reinicia para limpiar
mensajes, respuestas y marcas de prueba.
