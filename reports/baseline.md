# Línea base del navegador integrado

Fecha: 2026-09-04

Cambio: `complete-integrated-browser-platform`

Rama: `codex/upgrade-integrated-browser`

## Pruebas focalizadas

Comando:

```powershell
vitest run electron/__tests__/integrated-browser-service.test.ts electron/__tests__/integrated-browser-handlers.test.ts src/__tests__/services/integrated-browser-service.test.ts src/__tests__/components/IntegratedBrowserPanel.test.tsx
```

Resultado inicial: **82 pruebas aprobadas en 4 archivos**.

## Typecheck

Comandos:

```powershell
tsc --noEmit -p tsconfig.json
tsc --noEmit -p tsconfig.node.json
```

Resultado inicial: el typecheck de renderer completó y el de Node falló por dos errores preexistentes, ajenos al navegador integrado:

- `electron/whatsapp/delivery-events.ts:31`: el callback local no acepta `null` en `update.status`, aunque `WAMessageUpdate` sí puede entregarlo.
- `electron/whatsapp/delivery-events.ts:39`: se pasa `string | null | undefined` a un argumento que sólo admite `string | undefined`.

Estos errores se conservarán separados de cualquier regresión introducida por este cambio.
