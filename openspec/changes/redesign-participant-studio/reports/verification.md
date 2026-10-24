# Verificación del aula del participante

Fecha: 2026-10-24. Implementación terminada; QA visual y ensayo de dos cuentas pendientes.

## Evidencia ejecutada
- Pruebas focalizadas de ParticipantStudio, StudioCallBridge, participant-tutor,
  zoom-video-runtime y LearningWorkspace: 5 archivos, 33 pruebas aprobadas.
- `npm run test`: 501 archivos aprobados, 2 omitidos; 5710 pruebas aprobadas,
  5 omitidas. No se hicieron solicitudes a un proveedor IA ni reuniones reales.
- `npm run zoom:build`: tipos del paquete aislado y build aprobados.
- `node scripts/quality/smoke-zoom-runtime.mjs`: origen
  soflia-zoom://meeting y assets Video confirmados. No acredita una reunión real.
- `npm run lint:changed`: 28 archivos sin deuda nueva.
- `npm run harness:validate`, `npm run docs:check`, `npm run docs:system:check`,
  `npx tsc --noEmit -p tsconfig.node.json` y `git diff --check`: aprobados.
- `npm run verify:pr`: adapters, harness, supply-chain, documentación, seed,
  OpenSpec y test:quality aprobados. Se detuvo en typecheck por el error previo
  TS2345 de `electron/gmail/raw-message.ts:19` (`newline` no existe en Options).
  Sin errores del aula en ese resultado. Suite y lint se ejecutaron aparte.
- Fixture local localhost:4321: snapshot de alumno exitoso con escena, práctica,
  quiz y respuesta correcta oculta. Son ejemplos en memoria; no datos reales.

## Casos negativos y revisión independiente
Validación de ventana/origen/nonce y payload del frame, captions no disponibles,
fullscreen denegado, controles antes del ingreso, chat moderado, sala ajena,
entrega fallida y restauración desde snapshot, cancelación y respuesta tardía IA.
La política IA bloquea solicitudes sin referencia, identidad/sesión coincidente,
habilitación de organización o consentimiento vigente antes de acceder al proveedor.

Revisión independiente: se corrigieron la restauración de entrega propia y el
gate académico de IA. Segunda revisión sin P1/P2 nuevos; realizada por lectura.

## Límites y recuperación
La herramienta de navegador devolvió «Local browser use is disabled in Work settings»;
no se obtuvo captura ni se afirma validación visual. Queda revisar desktop/móvil,
reunión real y cuenta con captions habilitados. Meeting conserva los controles
oficiales no implementados por su adaptador. Configuración de audio es una prueba
local de dispositivos, no selección de entrada/salida de la llamada. Salas siguen
siendo académicas; mano/reacciones son mensajes confirmados, no eventos Zoom.

No se modificaron secretos, tablas, permisos remotos ni IPC. Para revertir, retirar
este cambio del renderer/runtime juntos; contratos académicos y datos permanecen.
