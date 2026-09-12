# Verificación de perfiles del navegador — 2026-09-05

Estado: evidencia histórica parcial. La [revisión posterior](verification-browser-boundaries-2026-09-05.md)
reabrió 4.1: el cierre completo y la purga no estaban verificados. Las afirmaciones
de ciclo completo o limpieza al salir de este reporte no describen garantías actuales.

## Alcance

Se completó el ciclo de perfiles autenticado, invitado y privado detrás de
`BROWSER_PROFILES_ENABLED`. El perfil autenticado conserva una partición
`persist:` y stores bajo el usuario derivado; invitado usa el ámbito neutro y
privado un ámbito aleatorio en una partición sin `persist:`. Cambiar de perfil
derriba vistas, cancela operaciones pendientes, cierra SQLite y conserva el
ámbito autenticado para volver.

## Evidencia

- `electron/__tests__/integrated-browser-service.test.ts`: aislamiento de
  particiones, cambio autenticado → privado → autenticado y limpieza de vistas.
- `electron/__tests__/integrated-browser-handlers.test.ts`: payload cerrado,
  rechazo de identificadores y canales de lectura/cambio de perfil.
- `electron/__tests__/preload/channel-cases.ts` y
  `electron/__tests__/preload/source-cases.ts`: allowlist y bridge tipado.
- `src/components/browser/BrowserRuntimeSupportPanel.tsx`: selector visible de
  perfil con explicación de persistencia y limpieza.

## Límites

El perfil privado usa un ámbito aleatorio temporal y se purga al salir; no se
sincroniza con la cuenta autenticada. La capacidad queda desactivada por
defecto y requiere `BROWSER_PROFILES_ENABLED=true`. No se ofrecen perfiles
persistentes creados por el usuario ni sincronización entre dispositivos.
