# Compilación aislada del producto — 2026-09-13

## Resultado y alcance

Avance de 9.5, sin cerrar la tarea. `npm run app:smoke:build` ejecutó typecheck
y la compilación de producción de Vite 8.2.1 para renderer, main y preload en
un temporal, sin copiar `.env`, heredar claves de proveedores o arrancar la
aplicación. Se comprobaron `dist/index.html`, `dist-electron/main.js` y
`dist-electron/preload.js`, todos no vacíos. No se generó ni instaló un NSIS.

Artefactos conservados:
`C:/Users/fysg5/AppData/Local/Temp/pulse-app-build-y5GCFy`.
Su `build-report.json` registra código 0, 2781 fuentes seleccionadas y fecha
`2026-09-14T02:19:16.474Z` (20:19 del 13 de septiembre en Ciudad de México).
Es un bundle de verificación sin configuración, no un release utilizable con
cuentas reales. No se tocaron los outputs del worktree ni del checkout padre.

## Implementación

El nuevo runner selecciona fuentes de Git, incluyendo cambios actuales y
archivos nuevos no ignorados de las raíces permitidas. Rechaza rutas absolutas,
componentes ocultos, recorridos y enlaces en fuentes; no copia dependencias,
outputs, SQL ni runtime Python. Incluye TypeScript compartido de `database/`
porque los tests de contratos lo importan durante typecheck. Reutiliza la
instalación local de dependencias por junction/enlace y conserva todo el temporal.
No instalar dependencias ni ejecutar este runner sobre código no confiable.

El hijo recibe únicamente variables básicas del sistema. No hereda `NODE_OPTIONS`,
`ELECTRON_RUN_AS_NODE`, claves de proveedores ni flags del producto. No acepta
argumentos para cambiar destino, invocar publicación o proporcionar credenciales.
La revisión de artefactos precede cualquier reporte exitoso. No hay limpieza
recursiva automática ni descarga de herramientas en este comando.

## Evidencia

- `npm run verify:pr` con `VITEST_MAX_WORKERS=4`: **compuerta completa aprobada**.
  Suite general: **3335 pruebas en 314 archivos**, inicio 20:20:32, 115,39 s.
  Incluye typecheck, lint incremental de 20 archivos, harness, semilla,
  supply-chain y las 27 validaciones OpenSpec; sin exclusiones nuevas.
- `npm run docs:check`: enlaces válidos en 293 Markdown tras añadir el reporte;
  OpenSpec estricto aprobado. Inventario recalculado: 479 archivos de pruebas,
  incluidos auxiliares (334 main, 144 renderer, uno scripts).
- `npm run test -- app-build-smoke --reporter=dot --silent=passed-only`:
  **23 casos aprobados**, 20:18:56, 340 ms; selección de fuentes y entorno mínimo.
- `npm run app:smoke:build`: aprobado; renderer 1960 módulos (3,49 s), main 1483
  (1,65 s), preload 25 (20 ms), además del typecheck completo previo.
- `npm run runtime:stable`: Electron **43.4.0** aprobado.
- ESLint explícito del runner MJS: aprobado tras importar `URL` desde Node.
- Primer intento de staging omitía un TypeScript compartido de Lia y falló
  typecheck; se corrigió la selección y se repitió en un temporal nuevo.
  No se cuenta ese primer intento como build aprobado. Su evidencia permanece
  en `C:/Users/fysg5/AppData/Local/Temp/pulse-app-build-uQFecD`.

## Revisión adversarial y límites

El agente principal revisó propagación de entorno, selección de fuentes,
enlaces, publicación de resultados y riesgo de borrar dependencias compartidas.
Los 23 casos verifican exclusiones sin relajar el build real. La prueba confía
en el repositorio y dependencias locales; no es sandbox frente a scripts hostiles
ni auditoría que detecte secretos escritos directamente en el código.

Vite emite avisos de chunks grandes (App aproximadamente 2,57 MB sin gzip) y
mezcla de imports estáticos/dinámicos. No son errores de compilación, pero no se
afirma presupuesto de rendimiento cumplido ni arranque rápido medido. La versión
estable y la compilación no prueban que todas las dependencias nativas funcionen
en un instalador o en otro equipo.

El runtime `python-runtime/python.exe` no está preparado en este worktree.
Empaquetar requiere su preparación y el hook que verifica Python distribuido;
no se omitió ese hook ni se fabricó un paquete incompleto. Restan instalación,
recorrido manual de UI/IPC, Windows Hello humano y Auth/RLS/revocación con dos
equipos reales. No se ejecutaron migraciones ni despliegues; siguen a cargo del
usuario. El cambio conserva **63/64 tareas completas**, con 9.5 abierta.

Los temporales contienen una junction hacia las dependencias del worktree:
si se retiran manualmente, no recorrer ese enlace ni borrar su destino. No se
eliminó material del usuario durante esta verificación.
