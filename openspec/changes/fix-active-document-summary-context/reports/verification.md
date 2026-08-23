# Evidencia de verificación

Fecha: 2026-08-18.

## Resultado del cambio

- `npx openspec validate fix-active-document-summary-context --strict --no-interactive`: aprobado.
- `npm run openspec:validate`: 24 cambios aprobados.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: 33 archivos revisados sin deuda nueva.
- `npm run harness:validate`: aprobado, 25 rutas y 9 skills canónicas.
- `npm run docs:check`: aprobado, 233 archivos Markdown activos.
- `npm run docs:system:check`: aprobado, 28 documentos, 150 IDs, 339 canales y 393 archivos de prueba.
- Suite focalizada de lectura documental, IPC, preload, routing, memoria y UI: 174 pruebas aprobadas.
- Regresión adicional de OpenAI y presupuesto de herramientas: 14 pruebas aprobadas.
- Repetición final posterior a la revisión adversarial: 139 pruebas aprobadas.
- `git diff --check`: sin errores.

## Compuerta de PR y deuda ajena

`npm run verify:pr` se ejecutó. Sus primeras cinco etapas aprobaron, pero se
detuvo en `skills:seed:check`: la semilla
`database/lia/migrations/system-skills-catalog.sql` ya diverge de
`src/shared/skills/registry.ts`. Ninguno de esos dos archivos forma parte del
diff de este cambio, por lo que no se regeneró una migración ajena al alcance.

`npm run test` recorrió la suite global y mostró un fallo ajeno en
`WA-160`: la prueba espera `index.html`, mientras el runtime de presentaciones
escribe `deck.json`. La reproducción dirigida dejó 21 pruebas aprobadas y ese
único fallo; ambos archivos implicados quedan fuera del diff. El primer recorrido
global también sufrió un timeout transitorio en el reproductor de presentaciones;
su repetición dirigida aprobó sus tres pruebas en menos de medio segundo.

## Casos de aceptación cubiertos

- “Dame un resumen del Documento” lee el documento activo y no adjunta el DOM
  de otra página.
- “dame un resumen ejecutivo” vuelve a leer la fuente documental citada en el
  turno anterior.
- Dos conversaciones del mismo owner generan claves de sesión reciente distintas.
- Un cambio de pestaña durante la extracción invalida el resultado.
- El agotamiento de herramientas en Gemini y OpenAI no confirma acciones ni
  produce un éxito genérico.
