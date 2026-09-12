# Verificación de transferencia de credenciales

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.

## Implementación

- `BrowserCredentialVault` prepara importaciones con límite de 500 entradas,
  validación de origen HTTPS/localhost, deduplicación, revisión de huella,
  TTL de cinco minutos y commit de un solo uso.
- `BrowserCredentialTransfer` abre y guarda archivos sólo desde `main`. La
  exportación exige advertencia nativa, destino explícito y archivo nuevo con
  permisos restringidos; la importación muestra conteos y permite conservar o
  actualizar conflictos.
- IPC, preload, wrapper y UI sólo intercambian conteos. Ningún secreto, ruta o
  contenido del archivo se devuelve al renderer o al agente.

## Evidencia

```text
npm run test -- electron/__tests__/integrated-browser-credential-transfer.test.ts electron/__tests__/integrated-browser-storage.test.ts electron/__tests__/integrated-browser-handlers.test.ts src/__tests__/services/integrated-browser-service.test.ts --maxWorkers=1
5 archivos / 80 pruebas aprobadas
npm run typecheck
aprobado
```

La prueba negativa cubre cancelación sin escritura, conflictos, duplicados,
orígenes inválidos, exportación sin secretos en el resultado y reintento por
archivo seleccionado. No se afirma autenticación del SO: Windows Hello y
passkeys siguen fuera de este bloque.
