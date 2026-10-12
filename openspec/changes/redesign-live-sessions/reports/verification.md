# Verificación de agenda y aula

Este registro corresponde al diseño anterior. El reinicio del aula como lienzo vacío se documenta en [su verificación actual](empty-classroom-verification.md).

Fecha: 2026-10-11. Estado: implementación local; sin despliegue remoto.

## Resultado

Menú con Sesiones síncronas debajo de Navegador y Reuniones. Agenda autenticada por organización, paginación, separación alumno/instructor y metadatos públicos. Aula expandida antes del ingreso, compacta junto al navegador integrado después de pulsar Entrar; participación, Pulse Checks e información separados. Se conservan reglas, consentimiento, votos, prácticas, ayuda y UUID de reintentos.

## Evidencia ejecutada

- Hub: 19 pruebas focalizadas de agenda/aula/deep link/catálogo/preload y 4 pruebas adicionales de handler/wrapper exitosas.
- Learning: 23 pruebas de la ruta nueva, acceso Zoom y consultas/aislamiento académico en PGlite exitosas.
- `node test/manual/live-sessions/verify.cjs`: agenda → aula → compartir una pregunta → apertura explícita → información → Pulse Checks → regreso. Seis capturas, ambos temas, ancho 390 px y agenda de 560 px en ventana desktop, sin errores JavaScript ni desbordamiento horizontal.
- Hub `npm run typecheck`: exitoso. `npm run lint:changed`: 112 archivos sin deuda nueva. Harness, supply chain, documentación y 49 cambios OpenSpec validados dentro de la compuerta.
- Learning `tsc --noEmit -p tsconfig.typecheck.app.json`: falla en archivos ajenos a la ruta nueva; no hay diagnósticos en `api/auth/live/catalog`. Registro en `learning-typecheck.log`.
- `npm run verify:pr`: llegó a la suite completa y detectó un tooltip incompatible (corregido) y dos fallos de permisos del navegador. El tooltip y ambos casos de permisos pasaron aisladamente. La repetición completa `npm run test -- --maxWorkers=4` pasó: **363 archivos, 3877 pruebas y 1 prueba omitida**. Registro inicial en `hub-gate.log` y resultado final en `hub-tests.log`; no se declara que el comando original de compuerta terminó en verde.

## Límites y reproducción

La vista previa usa datos de ejemplo y simula Zoom; no acredita cámara, audio ni admisión real. La API de catálogo requiere publicación de Learning y reinicio del cliente Hub para cargar el nuevo preload. No hay cambios de esquema, migraciones ni acceso directo desde renderer a Supabase. El listado reutiliza las páginas acotadas de cursos/instructores del catálogo existente, con etiquetas genéricas cuando el metadato no está en esa página.

Iniciar la vista previa con `npx vite --config test/manual/live-sessions/vite.config.mts` y abrir `http://127.0.0.1:4320/`. La fixture no lee `.env` ni usa cuentas reales. Para revertir, retirar los archivos nuevos y los hunks del cambio, conservando las modificaciones preexistentes y concurrentes del checkout.

## Corrección del rechazo de agenda

La consulta real mediante `window.learningLive.catalog` de la aplicación en ejecución devolvió `access_denied`. Se observó únicamente el estado y código de error de su petición normal: HTTP 401 y `UNAUTHENTICATED`, sin leer ni imprimir credenciales. La observación temporal de fetch se retiró en `finally`. El origen público se verificó en el chunk compilado de SSO; no se leyó `.env`.

Causa confirmada en el código Learning: `/api/auth/live/catalog` faltaba en la lista exacta de rutas cuya autenticación se delega al handler bearer; además consumía el presupuesto de login. Hub convertía todos los HTTP 4xx salvo 429 en falta de permisos. Se añadieron delegación y presupuesto de sesiones, se distinguieron 401/403/404/405/429/5xx, y se acotó la lectura del error remoto a 4 KiB. Solo 403 remoto se presenta como falta de acceso. Los logs incluyen estado HTTP y clasificación sin contenido remoto ni identidad.

Las pruebas de regresión fallaron antes de corregir: siete casos Hub y dos Learning. Después pasaron 23 pruebas Hub en cuatro archivos y 29 Learning en cuatro archivos, incluidos filtros, presupuesto, catálogo y acceso Zoom. La corrección Learning permanece local: no se ha desplegado ni se ha verificado una agenda real exitosa.

Tras recompilar Hub, su API real devolvió `unavailable` con «La agenda de Learning todavía no está habilitada para SofLIA Hub», en lugar de atribuir falta de permisos. `npx eslint` de los dos archivos Hub y cuatro Learning modificados en esta corrección terminó sin incidencias.

`npm run verify:pr` se ejecutó: la primera ejecución detectó un inventario derivado desactualizado por archivos concurrentes; se sincronizó mediante `npm run docs:inventory:sync`. La repetición pasó adaptadores, harness, supply chain, documentación de sistema (530 archivos de prueba), enlaces (417 Markdown), semilla, 49 cambios OpenSpec y typecheck. Se detuvo en dos errores de lint de archivos ajenos a este arreglo: `src/components/agents/AgentActivityPanel.tsx:56` y `src/components/agents/AgentActivityProvider.tsx:24`, ambos `react-hooks/set-state-in-effect`. No se modificaron esos cambios concurrentes ni se declara la compuerta global exitosa. Registro: `hub-catalog-fix-gate.log`. La suite completa no se repitió en esta corrección; la evidencia de 3877 pruebas pertenece al estado anterior descrito arriba.
