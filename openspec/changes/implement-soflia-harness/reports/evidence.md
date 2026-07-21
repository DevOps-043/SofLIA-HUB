# Evidencia

## Cambio

- Nombre: `implement-soflia-harness`.
- Fecha y entorno: 2026-07-21, Windows, Node 24, rama `codex/harness-foundation`.
- Efectos externos: ninguno; no se ejecutaron migraciones, despliegues ni publicaciones.

## Compuerta final

`npm run verify:pr` completó correctamente sobre el estado final:

- 24 adaptadores verificados tras adaptar las superficies a Codex, Claude y Antigravity.
- 18 rutas obligatorias y 8 skills canónicas válidas.
- 63 archivos Markdown activos sin enlaces relativos rotos.
- Cambio OpenSpec válido en modo estricto.
- TypeScript estricto sin errores en aplicación y configuración Vite.
- Lint incremental sin errores en archivos TypeScript modificados.
- 103 archivos de prueba y 948 pruebas aprobadas.
- `better-sqlite3` reconstruido para Node durante pruebas y restaurado exclusivamente para Electron.

La validación oficial `quick_validate.py` de `skill-creator` aprobó las 8 skills.
`npm run build:app` compiló renderer, Electron main y preload correctamente.

## Revisión adversarial

Se comprobaron rutas antiguas, artefactos versionados, duplicados, allowlists
documentales, ABI nativa, estado Git y dependencias. La revisión detectó y corrigió:

- rutas activas hacia el antiguo directorio `sql/`;
- mensajes que ubicaban Meeting Ops en IRIS en vez de Lia;
- restauración demasiado amplia de módulos nativos, limitada ahora a `better-sqlite3`;
- cinco pruebas de autenticación desactualizadas respecto al componente actual;
- una vulnerabilidad crítica transitiva de `tar` y una dependencia local innecesaria de `npm`.

El audit final reporta 26 vulnerabilidades conocidas: 2 bajas, 12 moderadas,
12 altas y 0 críticas. No se usó `npm audit fix --force`.

## Riesgo residual

- El lint global mantiene la deuda histórica registrada en `docs/reports/harness-baseline-2026-07-21.md`; la compuerta impide deuda nueva.
- El renderer mantiene advertencias de bundle grande e importaciones estáticas/dinámicas mezcladas.
- Las 26 vulnerabilidades restantes requieren cambios separados por paquete y superficie de explotación.
- La gobernanza runtime está especificada y denegada por defecto, pero el registro tipado ejecutable se implementará en un cambio independiente.
- Se verificó el build de aplicación; el empaquetado de instalador queda reservado a `npm run verify:release`.

## Rollback

Revertir la rama recupera todas las rutas mediante Git. No hay datos remotos que
revertir. Los recursos movidos conservan historial y el Context Pack tiene una prueba
dirigida para su nueva ubicación.
