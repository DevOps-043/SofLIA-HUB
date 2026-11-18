# Verificación del primer turno del chat

Estado: arreglo verificado; compuerta global limitada por entorno Python. Fecha: 2026-11-18.

## Diagnóstico confirmado

AppContent usaba el identificador persistido, inicialmente null, en la clave de
ArtifactViewerProvider. Ese proveedor contiene el workspace y el controlador del
chat. Guardar el primer mensaje cambiaba la clave, remontaba todo el subárbol y
ejecutaba la cancelación del controlador. La vista nueva podía ocultar el
placeholder huérfano, dejando únicamente el mensaje de la persona.

La prueba anterior al arreglo reprodujo dos fallos: señal abortada después del
primer guardado y aviso de error no publicado. Tres pruebas negativas pasaron.
La captura es compatible con esta causa; no se inspeccionaron claves ni se
atribuyó el incidente a una respuesta específica del proveedor.

## Cambio y alcance

La clave utiliza ahora chatScopeId junto con usuario SOFIA y organización.
El gestor ya reserva ese UUID para el borrador y lo conserva al persistirlo.
Nuevo chat, selección de otro chat y cambios de identidad siguen cambiando el
ámbito. No hay cambios en modelos, API, IPC, permisos ni esquema de datos.

El arreglo se preparó en `.worktrees/fix-first-chat-response`, rama
`codex/fix-first-chat-response`, desde 8a230103. Se trasladaron únicamente sus
archivos al checkout activo para que el entorno de desarrollo los pueda usar.
Los cambios ajenos de selección de modelos y documentación runtime se conservaron.

## Evidencia ejecutada

- Antes del arreglo: `npx vitest run src/__tests__/app/first-chat-response.test.tsx`:
  2 fallos y 3 casos correctos; la señal ya estaba abortada tras guardar.
- Después del arreglo en el worktree: primer turno, runtime owner, navegación y
  routing de aula: 4 archivos, 18 pruebas correctas.
- En el checkout activo: `npx vitest run src/__tests__/app/first-chat-response.test.tsx src/__tests__/hooks/chat-runtime-owner.test.tsx src/__tests__/hooks/chat-navigation-isolation.test.tsx src/__tests__/app/learning-room-routing.test.tsx src/__tests__/components/ArtifactViewer.test.tsx src/__tests__/hooks/chat-external-turn-audit.test.tsx`:
  6 archivos, 30 pruebas correctas.
- `npm run typecheck`: correcto en el checkout activo.
- `npm run harness:validate`: correcto, 25 rutas y 10 skills.
- `npm run docs:inventory:sync` y `npm run docs:system:check`: correctos; el
  inventario se actualizó mediante script a 868 archivos de prueba.
- `npm run docs:check`: correcto, 1145 archivos Markdown activos antes de este reporte.
- `npm run lint:changed`: correcto, 17 archivos sin deuda nueva, incluidos cambios ajenos.
- `npx openspec validate fix-first-chat-response --strict --no-interactive`: correcto.
- `git diff --check`: correcto.
- Primera ejecución de `npm run verify:pr`: se detuvo en inventario desactualizado
  por la prueba nueva. Se sincronizó con el script y se reinició la compuerta.
- Segunda ejecución de `npm run verify:pr`: adaptadores, arnés, cadena de
  suministro, integridad CI, runtime, documentación, semilla y las 163
  especificaciones correctos; las 70 pruebas de herramientas pasaron. Se detuvo
  en `python-tools:test` porque no se encontró Python 3.12.x. Se comprobaron los
  comandos disponibles y las rutas habituales sin encontrar ese intérprete.
  No se omite la etapa ni se declara la compuerta aprobada.
- `npm run test:coverage`: ejecutada por separado después de la etapa Python.
  Mostró timeouts de 15 segundos en `bootstrap-environment-order.test.ts` y
  `browser-sensitive-page.test.ts`. Se interrumpió tras observar esos fallos
  fuera del flujo corregido; no se produjo una cobertura completa ni se aprobó
  esta etapa. No se verificó una línea base de estos timeouts y no se los
  declara deuda preexistente. No se modificaron esas pruebas ni sus límites.

## Revisión de riesgos

Se comprobó que retirar la clave por completo perdería la limpieza del visor;
se conserva la clave con el ámbito correcto. Las pruebas negativas verifican
nuevo borrador, cambio de usuario y organización, limpieza del archivo y rechazo
del texto tardío. La navegación A/B/A y el visor conservan sus regresiones.
No se modifican persistencia ni guardas del agente y no se añaden logs sensibles.

## Límites y reversión

Las pruebas usan inferencia simulada, guardado local y controlador reales dentro
de AppContent, con la presentación de AppWorkspace sustituida. No se ejecutó
una petición real al proveedor ni se comprobó visualmente la aplicación abierta.
La recarga del renderer permite usar el arreglo; el mensaje ya interrumpido
necesita un nuevo envío. No se construyó un instalador ni se publicó una versión.

Revertir la expresión de clave en AppContent restaura el estado previo y su
defecto, sin migración. Los otros archivos del arreglo son documentación y pruebas.
