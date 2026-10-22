# Evidencia de retirada de Project Hub

Inicio: 2026-10-19. Cierre de verificación: 2026-10-22. Base: f0b18bc. Rama: codex/remove-project-hub-integration.

## Alcance comprobado

- Retirados cliente REST, sesión Project Hub, handler, preload, allowlist, wrapper y vista externa.
- Retirados clientes IRIS, herramientas de chat/WhatsApp, contexto IRIS opcional de resúmenes diarios, selección de proyectos en reuniones y publicación externa.
- Retirados arranque dependiente de Project Hub, acceso/SSO del ecosistema y variables de esa integración en CI.
- Retirados la fuente del outbox y su entrada de despliegue local. No se intervino ninguna función remota.
- Extraídos cliente e identidad SOFIA reutilizados; la memoria y las conversaciones de WhatsApp conservan su identidad. Se rechazan teléfonos incompletos y coincidencias ambiguas.
- Conservaron carpetas, chats, fuentes, minutas, compromisos y registros históricos; las minutas nuevas no generan borradores de exportación.

## Conservación

La comparación Git no contiene cambios en `src/services/folder/`, `src/hooks/folder-manager/`, `src/components/ProjectHub.tsx`, las pestañas de chats/fuentes de carpeta, migraciones, snapshots ni archivos `.env`. No se ejecutaron migraciones, borrados de datos, despliegues ni llamadas de mutación remota. El checkout principal conserva el trabajo ajeno; esta entrega vive en el worktree `.worktrees/remove-project-hub-integration`.

## Verificación ejecutada

- Pruebas focalizadas iniciales: 55 casos aprobados en 7 archivos.
- Pruebas finales de retirada/preservación: 24 casos aprobados en 5 archivos, incluidos los orígenes retirados con reconexión explícita, aprobación local, teléfonos vacíos/ambiguos y carpetas en las tres posiciones de sidebar.
- `npx vite build --config vite.config.mts`: aprobado nuevamente en el estado final para renderer, main y preload. Advertencias de tamaño de chunks e imports estáticos/dinámicos; no errores. No equivale a empaquetado o prueba interactiva del instalador.
- `npm run typecheck`: aprobado en la compuerta tras corregir el fixture del nuevo test.
- `npm run lint:changed`: 126 archivos revisados sin deuda nueva.
- `npm run harness:validate`: aprobado, 25 rutas y 10 skills canónicas.
- `npm run docs:system:check`: aprobado, 28 documentos, 150 IDs, 464 canales y 594 archivos de prueba inventariados.
- `npm run docs:check`: enlaces válidos en 544 documentos activos.
- `npm run openspec:validate`: 67 cambios válidos, sin fallos.
- `$env:VITEST_MAX_WORKERS = '4'; npm run verify:pr`: aprobado en el estado final el 2026-10-22. 428 archivos aprobados y 2 omitidos; 4388 casos aprobados y 5 omitidos de 4393, sin fallos. La variable solo limita la concurrencia del proceso de verificación; no cambia configuración versionada, cobertura ni timeouts.

Una corrida global intermedia obtuvo 4386 casos aprobados, 5 omitidos y dos fallos: el menú aún esperaba el acceso retirado y una prueba de sugerencias del navegador falló bajo concurrencia. Se corrigió la expectativa del menú; ambos archivos pasaron después aislados (67/67 casos), sin modificar la implementación ni la prueba de sugerencias. La corrida completa del 2026-10-22 volvió a aprobar 4386 casos y omitir 5; solo fallaron por timeout dos casos de documentos (artifact-viewer y background-teams). Los 54 casos de ambos archivos pasaron después con --maxWorkers=2 en 7.42 s. La repetición final de verify:pr con VITEST_MAX_WORKERS=4 pasó completa. No se alteraron tests, timeout ni baseline para esta repetición.

Las corridas intermedias detectaron fixtures que todavía esperaban IRIS/dominios retirados y un campo `status` omitido en el nuevo fixture. Se corrigieron; no se ocultaron fallos con skips o cambios de baseline.

La inspección de los bundles finales no encontró canales `project-hub:*`, herramientas `get_iris_*`/`iris_get_*` ni dominios `sofliahub.netlify.app`/`irisia.netlify.app`.

## Revisión adversarial

Revisión del diff y consumidores con las hipótesis: (1) que se hubieran borrado o movido carpetas, (2) que siguieran expuestos canales o herramientas externos, (3) que SOFIA dependiera todavía de IRIS, (4) que el navegador entregara tokens a los orígenes retirados, (5) que continuaran creándose/publicándose acciones o que se borraran borradores anteriores. La inspección y los casos negativos refutan esas rutas en el código final. Se retiró también la creación/reemplazo de acciones de exportación; los registros anteriores siguen siendo legibles.

## Límites y reversión

No se implementa la fusión futura ni se acredita una prueba interactiva con cuentas reales. Las migraciones, snapshots, tokens cifrados inactivos y el archivo histórico `whatsapp-iris-sessions.json` se conservan. Si existiera un outbox ya desplegado, su retirada operativa queda pendiente de una intervención remota autorizada.

Reversión: revertir el commit de esta entrega; no hay migración de datos ni efectos externos que deshacer. No se publica PR ni se modifica el repositorio Project Hub.
