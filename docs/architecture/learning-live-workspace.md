# Aula de sesiones de Learning

Estado: implementación local. Actualizado: 2026-10-11.

<!-- evidence: src/components/learning-live/LearningWorkspace.tsx -->
<!-- evidence: electron/learning-workspace-access.ts -->
<!-- evidence: electron/learning-live-handlers.ts -->
<!-- evidence: electron/preload/learning-live-api.ts -->
<!-- evidence: src/services/learning-live-service.ts -->
<!-- evidence: src/shared/learning-workspace.contract.ts -->

La entrada **Sesiones síncronas**, debajo de Navegador y Reuniones en Herramientas Integradas, abre la agenda de la organización activa. Muestra hasta 20 sesiones autorizadas por página, destaca la primera sesión en vivo de la página inicial o la próxima por fecha y permite consultar las clases que imparte el usuario cuando tiene ese permiso. Incluye estados de carga, vacío, error y reintento. Los horarios usan la zona local del dispositivo.

Seleccionar una clase o recibir una referencia académica abre el aula React después del login. Una lectura del snapshot existente confirma `can_manage` para esa sesión; no se deducen permisos del correo ni de la agenda. Mientras se consulta se muestra carga, y ante un error se ofrece reintento. El instructor autorizado ve el estudio de diseño; el participante conserva su lienzo vacío como base para su siguiente diseño. Volver o cerrar regresan a la agenda. Ambas vistas sustituyen al navegador, al chat anterior, a la barra lateral de conversaciones y al monitor de agentes; no cierran ni navegan sus pestañas.

Por petición del usuario se retiraron la antesala, el acceso Zoom y las secciones Participar, Pulse Checks e Información anteriores. El nuevo estudio del instructor distribuye chat y estadísticas a la izquierda, vista previa y escenas al centro, actividades y material a la derecha y controles flotantes inferiores. El chat distingue al instructor por insignia y mantiene estado propio; los comandos, moderación, recursos, salas y quizzes cambian solo el diseño local. Temporizador y cronómetro liberan sus intervalos al desmontar. Los controles de audio, cámara y pantalla no solicitan dispositivos ni transmiten medios. La interfaz identifica esta fase como «Vista de diseño».

La aplicación real no inserta mensajes, participantes ni recursos ficticios. Los datos de ejemplo están exclusivamente en la fixture visual. Los archivos de Material y quizzes elegidos en el prototipo aportan solo nombre/tamaño a la lista, sin leer su contenido ni subirlo. Los archivos de imagen/video elegidos para Escenas se previsualizan localmente con URLs de objeto, liberadas al quitarlos o cerrar el estudio; no se envían ni persisten. No hay polling, mutaciones, IA ni apertura automática del navegador o chat general; un evento de apertura mientras el aula está activa tampoco monta ese workspace. La integración real de moderación, realtime, salas, archivos y medios queda pendiente.

La revisión visual prioriza la altura del chat: encabezado y barra de medios compactos, editor de una línea que puede crecer con el texto, estadísticas condensadas y campos redondeados con foco verde suave. Los números usan botones propios conservando escritura y flechas del teclado. El selector compartido de SofLIA sitúa las opciones dentro de un diálogo nativo cuando corresponde, para que sean visibles y operables en la capa modal. Material de la sesión reúne archivos, lecturas y quizzes: permite preparar una pregunta desde el panel o seleccionar un archivo de quiz como metadatos locales. Esa selección no importa preguntas, interpreta el formato ni publica una evaluación.

Pantalla, Cámara y Combinada pasan a un selector compacto junto a Vista previa. Escenas es un banco de hasta 12 contenidos preparados: láminas, fuentes de pantalla pendientes de captura e imágenes/videos locales de hasta 25 MB. Seleccionar una escena actualiza su contenido sin apagar los controles de compartir o medios. Grupo permite visitar las salas creadas desde Actividades y volver al grupo principal; el escenario y el chat muestran la sala activa, con mensajes y borradores separados. Eliminar o reemplazar las salas vuelve al grupo principal. Son cambios de contexto del prototipo, sin traslado real Zoom ni persistencia tras cerrar.

## Contratos y recursos

`learning-live:catalog` consulta `POST /api/auth/live/catalog` mediante main, handler, allowlist, preload y wrapper. Recibe únicamente slug de organización, página y vista alumno/instructor. Learning verifica bearer y membresía antes de reutilizar `live_catalog` con periodo `upcoming`. Devuelve metadatos públicos sin IDs Zoom ni enlaces de ingreso. Main valida versión, actor, máximo 20 resultados, límite de salida de 256 KiB, timeout de 15 segundos y ausencia de campos ajenos; comparte el límite de 4 solicitudes con el aula. La UI descarta respuestas tardías al cambiar organización o desmontar; no agrega polling del catálogo. La disponibilidad real exige publicar el endpoint de Learning junto con Hub.

El filtro de rutas Learning debe delegar exactamente `/api/auth/live/catalog` al handler bearer, sin exigir cookies del navegador, y asignar sus POST al presupuesto `live-access`. El handler conserva verificación de identidad y membresía. Hub distingue 403 de 401, ruta ausente (404/405), límite (429) y fallo de servidor. Un 401 con el código del filtro web `UNAUTHENTICATED` indica integración no habilitada; un 401 del handler indica sesión no validada. Los errores remotos se leen hasta 4 KiB y nunca se muestran literalmente. El log del catálogo registra solo estado HTTP y clasificación, sin identidad, credenciales ni cuerpos.

La prueba visual aislada vive en `test/manual/live-sessions/`: `npx vite --config test/manual/live-sessions/vite.config.mts` abre directamente el estudio con datos explícitamente de ejemplo en el puerto 4320, sin `.env`, cuentas ni medios reales. Su selector Instructor/Participante pertenece solo a la fixture; no concede roles en Hub. `node test/manual/live-sessions/verify.cjs` permite reproducir las comprobaciones de menú, agenda y lienzo del participante. Las pruebas de `AppContent` verifican la exclusión del navegador, chat y agentes, y las del estudio cubren los flujos locales.

`learning-live:workspace` cruza servicio main, handler, allowlist, preload y wrapper. Main construye `/api/auth/live/workspace` desde el origen Learning configurado; verifica entradas, tamaño real, salida versión 1 e identidad después de la respuesta. El bearer no llega al renderer. No acepta URLs, roles ni identidad arbitrarios por IPC.

El contrato de frontera se genera desde `apps/web/src/features/live/workspace.contract.ts` de Learning mediante `node scripts/quality/sync-learning-workspace-contract.mjs`. `--check` verifica igualdad exacta en el checkout conjunto PulseHub. Este script de desarrollo no se necesita en el producto empaquetado ni añade una dependencia runtime entre repositorios. Cualquier cambio requiere sincronizar, comprobar compatibilidad y validar ambos consumidores.

El hook anterior de colaboración dejó de formar parte del renderer. El aula consulta un snapshot para confirmar el rol y título, sin sondeo posterior; descarta respuestas tardías al cambiar de sesión o desmontar. El prototipo no envía mutaciones ni genera contenido.

El contrato privado conserva IA/telemetría desactivadas por defecto, consentimiento versionado, retención, revocación y auditoría. Learning mantiene transacciones, aislamiento y datos; Hub no escribe directamente en Supabase. Los límites del contrato son 32 KiB de entrada, 512 KiB de salida, 4 solicitudes main concurrentes, timeout HTTP de 15 segundos, 20 aportaciones por canal y 5 Pulse Checks. No hay restauración local de contenido del aula ni tokens.

## Límites y fases externas

El lienzo no reproduce contenido remoto ni acredita admisión o conexión con Zoom. La consulta de disponibilidad Learning no mide ancho de banda/jitter Zoom. No se controla el cliente Zoom desde el agente.

RTMS requiere app/consumidor persistente, correlación de identidad y consentimiento de fuentes. LTI requiere proveedor OIDC/JWKS y orígenes aprobados. Computer Use debe reutilizar guardas de aprobación del agente de escritorio, sin operar en la pestaña sensible. Exportación LRS, ontología predictiva y nudges corporativos requieren configuración/aprobación adicional. No se presentan estas fases como capacidades operativas.

El diseño vigente del instructor está en [el estudio](../../openspec/changes/design-instructor-live-studio/design.md), posterior al [reinicio del aula](../../openspec/changes/redesign-live-sessions/design.md). La colaboración anterior se conserva como antecedente en [el cambio V2](../../openspec/changes/enrich-learning-live-workspace/design.md) y el lanzamiento original en [su contrato](../../openspec/changes/launch-learning-live-sessions/integration.md). Migración y política se documentan de manera canónica en `docs/architecture/zoom-enrichment-v2.md` de Learning.
