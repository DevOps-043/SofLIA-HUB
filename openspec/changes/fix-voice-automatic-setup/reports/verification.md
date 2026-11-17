# Verificación de preparación automática de voz

Estado: implementación local verificada de forma dirigida; validación real
pendiente por bloqueo del SO. Fecha: 2026-11-13. Rama: codex/fix-voice-automatic-setup.

## Diagnóstico confirmado

El coordinador anterior sólo conservaba grants en memoria y los revocaba al
cambiar sesión. Enabled persistido no otorgaba consentimiento. El inicio de
dictado no preparaba Python ni Vosk; Ajustes mostraba un comando de desarrollo.
Orbe adelantaba el estado listening antes de confirmar el arranque, lo que
también habilitaba el analizador renderer del micrófono durante la espera.

## Resultados

- Vitest dirigido: 8 archivos, 136 pruebas aprobadas. Incluye autorización,
  sesiones Python, guardas de arranque, soporte del instalador, preparador nuevo,
  almacenamiento de consentimiento, mensajes de Ajustes y conversación del Orbe.
- `npm run lint:changed`: 22 archivos, sin deuda nueva.
- `npm run harness:validate`, `npm run docs:check`, `npm run docs:system:check`:
  aprobados. Inventario actualizado con `npm run docs:inventory:sync`.
- `npx openspec validate fix-voice-automatic-setup --strict --no-interactive`:
  aprobado.
- TypeScript de configuración (`npx tsc --noEmit -p tsconfig.node.json`): aprobado.
- `npm run typecheck` y comprobación posterior de tsconfig.json: rechazan tres
  usos de nonce en calendar-oauth-sdk.test.ts y calendar/microsoft-oauth.ts,
  archivos no modificados. MSAL instalado 5.5.0; manifiesto/lock requieren 7.1.1.
- `npm run test`: 642 archivos aprobados, 2 omitidos y 2 fallidos; 7579 pruebas
  aprobadas, 5 omitidas y 5 fallidas. Fallos: una prueba nonce de MSAL y cuatro
  presupuestos de colecciones Zod. Se reprodujeron ejecutando exclusivamente
  esos dos archivos, fuera de las pruebas de voz. Sus fuentes no se modificaron.
- `npm run verify:pr`: adapters, harness, supply-chain y CI aprobados; se detiene
  en runtime:stable por instalación Electron 44.5.1 frente a 44.9.3 fijado en
  manifiesto/lock. No se rebajaron compuertas ni versiones para obtener éxito.
- `npm run voice:smoke:native`: sus 12 comprobaciones IPC reales generaron reporte
  passed con servicio/diálogo simulados; el comando global falla después por la
  misma discrepancia de versión Electron. No se declara smoke aprobado.
- `npm run python:setup`: descargó y verificó el SHA256 del archivo Python, pero
  pip no pudo importar _socket: «Una directiva de Control de aplicaciones bloqueó
  este archivo». No se promocionó el staging como runtime listo. Python 3.15 del
  sistema no se usó como sustituto de Python 3.12 privado.

Las dependencias locales también incluyen Vitest 4.1.10 y Vite 8.2.1 frente a
4.1.12/8.2.4 fijados. No se reinstaló node_modules mientras la aplicación del
usuario tenía procesos Electron ejecutándose desde ese directorio.

## Revisión adversarial realizada

Autorrevisión, sin afirmar revisión independiente ni archivar el cambio.
Se intentó refutar: aislamiento de cuenta y firma, grant de dictado que amplía a
pasiva, enabled heredado como permiso, cancelación durante preparación, captura
tardía, fallo de instalación comunicado como éxito, filtración de stderr/rutas,
hooks o credenciales heredados al preparador, instalación duplicada y apertura
prematura del analizador renderer. Las pruebas dirigidas cubren esos casos.
Detener continúa cerrando el hijo aun si falla eliminar la preferencia persistida.

## Riesgos y recuperación

No se ha acreditado dictado con hardware ni instalación completa en este equipo:
Windows bloquea un componente. La app detecta ese caso con código específico y
no modifica la política del SO. La primera aprobación por cuenta sigue siendo
necesaria cuando no existe un registro explícito: enabled antiguo no se presume
consentimiento. La preparación ya iniciada puede terminar tras cancelar; la
captura cancelada responde de inmediato y no se inicia después. El preparador
padre tiene timeout; no se certifica cierre transaccional de descendientes.

Vosk conserva extracción/integridad y límites de descarga previos; el cambio
no constituye una auditoría de su instalador. No se realizó empaquetado/release,
deploy, cambio de secretos, migración ni modificación de Python del sistema.
Reversión: revertir las capas juntas; los archivos de consentimiento y runtime
local quedan ignorados por la versión anterior, sin requerir borrarlos.
