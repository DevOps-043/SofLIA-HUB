## 1. Base única y verificación del servidor

- [ ] 1.1 Reconciliar la retirada a7d705c y los cambios de seguridad actuales; acordar rama/base aislada y registrar qué se conserva, sin sobrescribir trabajo ajeno.
- [ ] 1.2 Comparar OpenAPI, schemas, rutas y cliente con la API realmente desplegada mediante lecturas autenticadas autorizadas y metadatos; registrar diferencias sin imprimir secretos.
- [ ] 1.3 Verificar identidades SOFIA/IRIS/Lia y permisos efectivos para proyecto/tareas/miembros/archivos con dos actores y dos organizaciones.
- [ ] 1.4 Inventariar consumidores y outbox heredados; definir cómo evitar la carpeta Lia automática en el nuevo flujo sin romper carpetas existentes.
- [ ] 1.5 Ejecutar spikes de picker/scopes/versiones/compartición por cuenta Google y Microsoft personal/empresarial; fijar matriz de capacidades y límites medidos.
- [x] 1.6 Inventariar navegación actual y contratos de hitos, ciclos, equipos, historial, webs y chats vinculados; identificar soporte real y extensiones sin asumir tablas/endpoints.

## 2. Contratos y persistencia del proyecto portable

- [ ] 2.1 Aprobar contrato de identidad portable, vínculos privados/compartidos, estados de aprovisionamiento, idempotencia y revisiones con sus errores y cuotas.
- [ ] 2.2 Diseñar migración IRIS aditiva y almacenamiento local privado; documentar PK/FK/unicidad/índices, aislamiento, preflight, backup, backfill voluntario y rollback.
- [ ] 2.3 Implementar en servidor transacción proyecto/propietario/operación y consulta de recibos; probar fallos intermedios y reintentos sin duplicación.
- [ ] 2.4 Implementar contratos/roles para ubicaciones, inventario, invitaciones, exportación/restauración y grants externos propios; no conceder acceso por manifiesto.
- [ ] 2.5 Aplicar migraciones sólo tras revisión/HITL correspondiente y comprobar aislamiento real por actor; no habilitar el feature sobre un estado de permisos no comprobado.

## 3. Carpeta física y ciclo de vida local

- [ ] 3.1 Implementar selector nativo con IDs opacos de destino, validación de raíz/subcarpeta, contenido existente, volúmenes y cambios de sesión.
- [ ] 3.2 Implementar manifiesto versionado y registro privado de vínculos por usuario/dispositivo, sin rutas absolutas en metadata compartida.
- [ ] 3.3 Implementar coordinador y diario durable de crear/registrar/finalizar; consultar efectos inciertos y reanudar tras reinicio.
- [ ] 3.4 Implementar abrir/vincular, volver a localizar, renombrar y trasladar con copia verificada, sin eliminar el origen implícitamente.
- [ ] 3.5 Completar las cuatro capas IPC y UI Nuevo proyecto con revisión de destino, cuenta, archivos/compartición y estado pendiente/activo.
- [ ] 3.6 Probar carpetas sincronizadas de escritorio, placeholders, falta de espacio/permisos, cancelación y filesystem sin primitivas opcionales; conservar las carpetas Lia anteriores.

## 4. Importación y exportación

- [ ] 4.1 Definir y versionar manifiesto/paquete, inventario, snapshots, exclusiones, remapeo de IDs y política de exportación; publicar un esquema y ejemplos como contrato.
- [ ] 4.2 Implementar preparación y vista previa de exportación, instantánea coherente, lectura por streaming, hashes y publicación segura sin sobrescribir.
- [ ] 4.3 Implementar inspección/importación con staging, cuotas descomprimidas, rutas relativas, nombres Windows/Unicode, enlaces y validación de relaciones.
- [ ] 4.4 Implementar abrir/vincular, copia independiente y restauración con reautorización, revisión esperada y respaldo; no importar ACL ni invitaciones como permisos.
- [ ] 4.5 Cubrir round-trip proyecto/tareas/archivos, paquete alterado/futuro, secretos excluidos, ZIP bomb, enlaces externos, interrupción, falta de espacio y reintento idempotente.

## 5. Colaboración sobre proyecto, tareas y archivos

- [ ] 5.1 Implementar invitaciones por identidad/correo con aceptación, vencimiento, revocación, auditoría y política de invitados externos acotados al proyecto.
- [ ] 5.2 Aplicar matriz owner/admin/member/viewer/guest y capacidades de exportar/restaurar/administrar almacenamiento sin autoelevación.
- [ ] 5.3 Configurar raíz compartida o publicación explícita de copias seleccionadas en Storage privado; no usar rutas locales como enlaces remotos.
- [ ] 5.4 Comprobar intersección de permisos del proyecto/proveedor; mostrar estados separados y conservar recibos de grants creados por Soflia.
- [ ] 5.5 Implementar revocación, detención de colas y recuperación de permisos parcialmente aplicados, sin borrar copias locales ajenas ni retirar grants preexistentes.
- [ ] 5.6 Probar entre dos personas/equipos, usuario con sólo uno de los permisos, último propietario, invitación robada/vencida, guest externo y revocación offline.
- [ ] 5.7 Verificar que el manifiesto cotidiano no publica snapshots de tareas/miembros y que el producto distingue acceso por Soflia del acceso directo permitido por ACL externas.

## 6. Google Drive directo

- [ ] 6.1 Implementar autorización incremental y selección nativa/externa vigente, cuenta correcta y custodia de credenciales; no reutilizar scopes amplios sin justificación.
- [ ] 6.2 Implementar raíz, inventario, lectura/escritura y subida reanudable según capacidades comprobadas; soportar o declarar explícitamente documentos nativos/unidades compartidas.
- [ ] 6.3 Implementar permisos/verificación de acceso y feed de cambios con cursor, reconciliación y recuperación de permisos insuficientes.
- [ ] 6.4 Completar UI/IPC y pruebas de conformidad Drive con archivos modificados externamente, cambio de cuenta, errores de cuota y conflictos conservando versiones.

## 7. OneDrive directo

- [ ] 7.1 Implementar autorización de almacenamiento separada del calendario y selector de drive/carpeta con soporte comprobado por tipo de cuenta.
- [ ] 7.2 Implementar lectura/escritura, sesiones de subida, eTags/precondiciones y tratamiento de respuestas inciertas, sin confundir AppFolder con carpeta arbitraria.
- [ ] 7.3 Implementar grants acotados, cambios delta y reconstrucción tras cursor inválido, sin propagar eliminaciones desconocidas a ciegas.
- [ ] 7.4 Completar UI/IPC y conformidad en cuentas personales y de trabajo/escuela incluidas en la matriz, con permisos denegados, caducidad y archivos sólo en línea.

## 8. Sincronización, trabajo offline y recuperación

- [ ] 8.1 Implementar cola durable separada por usuario/cuenta/proyecto, revisiones de negocio y revalidación de permisos antes de enviar.
- [ ] 8.2 Implementar versiones/conflictos de archivo, comparación y conservación de ambas copias; no last-write-wins silencioso.
- [ ] 8.3 Evitar dos motores sobre un árbol y ofrecer transición de modo con verificación y aprobación; tratar cambios externos como no confiables.
- [ ] 8.4 Implementar cancelación, exclusión de operaciones solapadas, backoff, cursores y progreso con recibos/uncertainty sin polling por vista.
- [ ] 8.5 Ejecutar escenarios de dos equipos offline, edición concurrente, revocación, pérdida de respuesta, crash en cada frontera y traslado entre local/Drive/OneDrive.

## 9. Entrega, documentación y rollout

- [ ] 9.1 Actualizar arquitectura, parámetros, contratos, datos, UI y guías de crear/importar/exportar/compartir/recuperar sin duplicar fuentes canónicas.
- [ ] 9.2 Ejecutar pruebas dirigidas y gate de PR en cada repo afectado; medir límites de carga/memoria con muestras antes de publicarlos como soporte.
- [ ] 9.3 Realizar smoke nativo con selectores/OAuth y E2E con dos actores/organizaciones/dispositivos, sin asumir que mocks prueban autorización de proveedor.
- [ ] 9.4 Completar revisión adversarial, respaldo/rollback, indicadores y banderas por capacidad; no ampliar permisos o baseline para pasar validaciones.
- [ ] 9.5 Habilitar por cohortes tras cumplir todas las capacidades confirmadas y registrar evidencia. Los pilotos locales no equivalen a entregar la conexión directa completa.

## 10. Apartado de proyecto y seguimiento (transversal a fases 3, 5 y 9)

- [ ] 10.1 Implementar entrada Proyectos, lista y navegación vertical contextual; abrir siempre Resumen en la superficie principal sin tabs, ventanas nuevas ni prompts enviados al chat.
- [ ] 10.2 Implementar destinos tipados proyecto/sección/recurso, breadcrumb y regreso con filtros/scroll conservados; preservar borrador del chat global y descartar respuestas de otro actor/proyecto.
- [ ] 10.3 Construir encabezado y resumen con objetivo/estado/responsable/fechas/ubicación, indicadores, tareas prioritarias, próximos hitos, ciclo, equipos, recursos y actividad; carga agregada autorizada.
- [ ] 10.4 Implementar Archivos, Páginas web y Chats vinculados con asociaciones explícitas, origen/visibilidad, detalle en la misma superficie y desvinculación sin borrar originales.
- [ ] 10.5 Implementar apertura contextual de chats reutilizando su dominio; impedir publicación de chats privados sin revisión de audiencia y contrato de permisos. No revelar títulos/previews/contadores ajenos.
- [ ] 10.6 Extender contratos y persistencia requeridos para hitos, ciclos opcionales, múltiples equipos e historial, con migraciones aditivas y permisos revisados; no derivar acceso masivo de asignar un equipo.
- [ ] 10.7 Implementar Hitos/Ciclos/Equipos con responsables, fechas, relaciones y estados opcionales; permitir tareas sin ciclo/hito y proyecto sin equipos asignados.
- [ ] 10.8 Definir métricas compartidas resumen/detalle con ámbito, periodo, zona, fórmulas y frescura; no calcular burndown/tiempo de ciclo sin historial ni mezclar escalas incompatibles.
- [ ] 10.9 Implementar carga/vacío/no configurado/no soportado/sin acceso/error/reintento/offline, paginación y caché aislada; aplicar tokens, teclado, foco y diseño adaptable en ambos temas.
- [ ] 10.10 Verificar previews y URLs no confiables, sin scripts/cookies de sesión ni SSRF; un sitio no previsualizable no abre pestañas o ventanas automáticamente.
- [ ] 10.11 Probar E2E abrir proyecto, navegar todos los apartados, abrir chat/recurso y volver sin ventanas/pestañas nuevas; cubrir equipos/ciclos ausentes, cero tareas, error de métricas y cambio rápido de actor/proyecto.
- [ ] 10.12 Revisar privacidad de asociaciones, paridad de métricas y aceptación visual/nativa antes de la liberación de fase 9; el mockup no constituye evidencia de implementación.
- [ ] 10.13 Componer el lateral de proyecto sobre Sidebar/Header/TopActions/UserMenu y PanelResizeGrip existentes, conservando envolvente flotante, radios, blur, sombra, tamaño/colapso y adaptación de posición; mantener el panel central aprobado.
- [ ] 10.14 Añadir Nuevo chat, búsqueda y chats recientes/fijados filtrados por proyecto, con menú/pie accesibles en baja altura; globo Navegador con etiqueta accesible y estado activo/degradado.
- [ ] 10.15 Persistir de forma idempotente conversación y pertenencia al proyecto para todas sus entradas, incluidos atajos, tareas y navegador; cubrir fallo de asociación, offline, cierre y respuesta tardía después de cambiar de proyecto sin fallback global.
- [ ] 10.16 Integrar el navegador existente con contexto de proyecto y reserva real de viewport/bounds para el lateral flotante; filtrar selector de chats y conservar regreso, sin nuevas ventanas o pestañas por abrir el apartado.
- [ ] 10.17 Probar persistencia y aislamiento de chats entre proyectos/actores, privacidad, búsqueda/conteos, historial no publicado, resize/colapso con web nativa, teclado/zoom y baja altura, preservando preferencias y chats generales existentes.

## 11. Entrega del panel visual solicitada después de la planificación

- [x] 11.1 Implementar el lateral sobre Sidebar/Header/UserMenu/PanelResizeGrip existentes, con fuente e iconografía del Hub, botones más redondeados, búsqueda contextual, navegador y chats recientes.
- [x] 11.2 Sustituir las pestañas del panel de gestión y la entrada de carpetas por navegación del proyecto en la superficie principal, con apartados y resumen.
- [x] 11.3 Conectar tareas, archivos, webs, miembros, actividad y métricas a los contratos disponibles; mantener formularios inline y cancelación de transferencias.
- [x] 11.4 Capturar contexto y proteger cargas tardías; conservar pertenencia a carpetas existentes y comprobar el vínculo/permisos antes de habilitar chats de gestión, sin fallback global.
- [x] 11.5 Probar navegación, filtros, errores, cero tareas y contexto de chat con pruebas dirigidas; crear fixture nativa sin credenciales para revisión visual en ambos temas y tamaño compacto.
- [x] 11.6 Completar compuerta de PR, revisión adversarial y traspaso selectivo al checkout del usuario, conservando cambios ajenos y documentando las capacidades pendientes.

El bloque 11 implementa el panel solicitado. El resto del plan permanece pendiente salvo tareas expresamente marcadas: no se aplicaron migraciones, no se completaron proveedores directos ni se certificó colaboración de dos actores. La UI no presenta esas capacidades como implementadas.

## 12. Gestión funcional solicitada el 2026-10-23

- [x] 12.1 Verificar contratos y metadatos de Project Hub/IRIS, preservar carpetas y aislar cambios en ambos repositorios.
- [x] 12.2 Implementar tareas con filtros/paginación, edición completa, responsable, prioridad, fechas, estimaciones, ciclo, subtareas, etiquetas, comentarios, documentos e historial, validando referencias y revisión.
- [x] 12.3 Implementar documentos de proyecto/tarea, etiquetas de evidencia, archivo lógico y desvinculación que conserve los originales; mantener transferencias nativas existentes.
- [x] 12.4 Implementar hitos y equipo principal con permisos efectivos, directorio, integrantes, roles, creación atómica y protección del propietario.
- [x] 12.5 Conectar cuatro capas IPC y paneles con tipografía/iconografía/controles existentes; conservar errores, incertidumbre y contexto.
- [x] 12.6 Completar pruebas dirigidas, compuertas, revisión adversarial, documentación y traspaso selectivo verificado.
- [ ] 12.7 Con autorización explícita y respaldo revisado, aplicar migración IRIS, publicar rutas del servidor y comprobar E2E con dos actores autorizados en el entorno elegido.

El bloque 12 usa el esquema verificado: un equipo principal y ciclos del equipo. No declara implementados múltiples equipos por proyecto, relaciones tarea-hito, motores de sincronización ni la portabilidad completa de los bloques anteriores.
