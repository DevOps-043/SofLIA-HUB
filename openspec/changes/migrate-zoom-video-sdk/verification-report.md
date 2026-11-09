# Verificación de Video SDK

Estado: implementación local verificada; activación de cuenta y despliegue pendientes. Fecha: 2026-10-19.

## Alcance entregado

Hub añade Video SDK 2.6.0 al paquete aislado, conserva Meeting SDK mediante carga diferida y recibe el contrato canónico de Learning. Hay controles de audio, cámara y pantalla, validación de origen/nonce, destrucción después de operaciones pendientes y assets locales servidos con allowlist. No se añaden canales IPC ni primitivas nativas.

Learning incorpora proveedor persistente, migración aditiva privada, programación REST con grabación automática confirmada, firma de JWT derivada del actor y cierre de instancias por aula. El worker reconcilia Video por cuenta e importa archivos compuestos mediante las garantías privadas existentes. La categoría Webinar no añade el producto Zoom Webinars ni sus restricciones de publicación automáticamente.

## Evidencia ejecutada

| Proyecto | Comando | Resultado |
| --- | --- | --- |
| Hub | `npm run verify:pr` | Completado: adaptadores, arnés, suministro, documentación, OpenSpec estricto, tipos, lint incremental y suite completa. 431 archivos aprobados, 2 omitidos; 4396 pruebas aprobadas, 5 omitidas. |
| Hub | `npm run zoom:build` | Instalación aislada con scripts deshabilitados, tipos y compilación correctos; 0 vulnerabilidades reportadas por npm en el paquete aislado. |
| Hub | `npx --no-install vite build --config vite.zoom.config.mts` | Repetido tras ajustes de configuración; compilación correcta. Aviso de tamaño en bundles de proveedores, cargados por separado. |
| Hub | `node scripts/quality/smoke-zoom-runtime.mjs` | Electron: `SDK_READY_ORIGIN=soflia-zoom://meeting;VIDEO_ASSETS=true`. Verifica aislamiento, manifiesto y MIME/bytes WASM; no inicia una llamada real. |
| Hub | Pruebas dirigidas de runtime, protocolo y captura | 7 pruebas aprobadas. Incluidas también en la suite completa. |
| Learning | `npm run test --workspace=apps/web -- src/features/live/__tests__ --maxWorkers=2` | 22 archivos y 142 pruebas aprobadas. Incluye migraciones PGlite, ingreso, programación, cierre, grabaciones y transferencia con credencial Video. |
| Learning | `npx --no-install tsc --noEmit -p apps/web/tsconfig.recordings.json` | Correcto. Antes se generaron tipos de Next mediante `next typegen`; no se alteraron secretos ni se ejecutó una compilación de producción. |
| Ambos | `git diff --check` | Correcto. |

Las primeras pruebas detectaron un mock incorrecto de errores de servidor y otro que no interceptaba el SDK real; ambos se corrigieron y las suites se repitieron. No se atribuyen esos fallos al producto.

## Revisión adversarial

Se revisaron el diff y los contratos intentando refutar aislamiento entre organizaciones, roles derivados, compatibilidad Meeting, idempotencia, compensación, permisos SQL, correspondencia de grabaciones y limpieza durante carreras.

- Corregido: la cancelación intentaba borrar una configuración Video que ya hubiera iniciado. La API solo permite borrar sesiones no iniciadas; ahora el cierre termina instancias y conserva referencias para grabaciones. La compensación de programación elimina únicamente una configuración recién creada, después de descartar una transacción confirmada.
- Corregido: la función transaccional ahora revalida organización activa, membresía, usuario y autoría después de la llamada al proveedor. Pruebas negativas rechazan identidad/organización ajenas, clientes públicos y duplicados.
- Corregido: se aplican las reglas de codificación de IDs correspondientes a cierre/configuración y grabaciones; se cubren IDs con barras y signos especiales.
- Comprobado: el worker rechaza cuenta, proveedor, nombre, clave o instancia incompatibles antes de descargar; no persiste URLs de descarga. Las credenciales Video no se sustituyen por OAuth Meeting en reintentos.
- Comprobado: salir durante una unión pendiente no anuncia una conexión tardía y destruye el cliente una vez; comandos de otro origen no lo controlan. No se amplía preload ni la allowlist IPC.

## Activación y límites

La guía canónica está en `SofLIA-Learning/docs/live-video-sdk.md`. Learning se preparó desde `origin/main` f918c456, que ya incluye estudio y grabaciones; el checkout principal local estaba atrasado. Ambos cambios están en worktrees separados, rama `codex/zoom-video-sdk`, sin alterar los checkouts principales ni sus cambios ajenos.

Antes de activar: aplicar la migración revisada en staging, configurar credenciales Video del mismo proyecto/cuenta, verificar cloud recording, sincronizar versiones Hub/Learning y realizar prueba real con instructor/alumnos, dos aulas simultáneas e importación/reproducción privada. Solo entonces habilitar `LIVE_VIDEO_PROVIDER=zoom-video` para nuevas aulas. Mantener Meeting y sus credenciales para aulas anteriores.

No se compraron planes, leyeron archivos .env, ejecutaron migraciones remotas ni desplegaron servicios. Los tokens bearer entregados conservan validez hasta caducar; cerrar el aula bloquea nuevas emisiones y termina instancias, sin revocación criptográfica del token. Simultaneidad, facturación, capacidad, grabación efectiva, calidad audiovisual y sesiones de tres horas requieren la cuenta real; los mocks y el smoke no las certifican.
