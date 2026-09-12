# Diagnóstico local exportable del navegador

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Estado: tarea 8.3 implementada y verificada; cambio global en 29/64.
No es release ni despliegue. Continúa la
[importación de marcadores](verification-bookmark-import-2026-09-05.md).

## Alcance y resultado

El panel Soporte conserva las versiones visibles y añade actualización con
reintento y exportación JSON. El nuevo módulo
`electron/integrated-browser/diagnostic-report.ts` proyecta únicamente campos
cerrados: esquema v1, periodo del perfil, versiones normalizadas, estados de
protección/política cargada y 12 métricas con fuente y agregación `snapshot`.
Pestañas/vistas, grupos, ventanas separadas y descargas retenidas se cuentan
desde los registros main, sin consultar historial, credenciales o contenido.
Versiones fuera del formato admitido se representan con null, no con texto crudo.

No se instala un colector periódico ni se transmiten datos. Los conteos describen
el instante de captura, no totales históricos del periodo. No se exportan URLs,
consultas, títulos, identificadores, nombres de archivo, mensajes de error,
cookies o secretos. Esto no concede acceso a otros perfiles ni administración
centralizada de una organización.

`integrated-browser:runtime-diagnostic-export` exige sesión y emisor/frame
principal, rechaza todos los argumentos y devuelve sólo
`diagnosticExport: { cancelled, exported }`. El servicio comprueba perfil
autenticado, generación, ventana, transición y cierre; la aprobación vence a
los cinco minutos y hay una sola exportación pendiente. No hay canal para
aprobar, obtener un reporte arbitrario, escribir una ruta enviada por renderer
o dar esta herramienta a agentes runtime.

La confirmación nativa tiene cancelar por omisión. Tras seleccionar un destino
JSON nuevo se escribe un temporal exclusivo, sincronizado y acotado a 64 KiB;
un enlace exclusivo publica el archivo completo sin sobrescribir. Los temporales
propios se retiran y los fallos se traducen a mensajes públicos constantes.

## Evidencia

La primera suite focalizada pasó con 199 pruebas; TypeScript detectó dos dobles
de cancelación sin `filePath`, que se ajustaron al contrato Electron. Se añadieron
pruebas del servicio real: suite focalizada posterior de **7 archivos / 202
pruebas aprobadas**. Lint detectó actualizaciones de estado en la ruta inicial
del efecto; se movieron a callbacks de la consulta y se cubrió también la
ausencia síncrona del bridge. No se desactivaron reglas ni ampliaron baselines.

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service
```

Regresión final: **52 archivos / 584 pruebas aprobadas**, 18,22 segundos,
inicio 12:35:23 local. No es la suite completa del repositorio.

| Verificación | Resultado |
|---|---|
| `npm run typecheck` | Aprobado: renderer y main |
| `npm run lint:changed` | Aprobado: 85 archivos sin deuda nueva |
| `npm run openspec:validate` | 26 cambios aprobados |
| `npm run verify:pr` | Falló en la semilla SQL preexistente; etapas posteriores no ejecutadas |
| Gates anteriores a la semilla | Adaptadores 27; arnés 25 rutas/9 skills; suministro 11 vetos/18 hooks; documentación 28 documentos/150 IDs/405 canales/419 archivos de prueba; enlaces válidos |
| `git diff HEAD --check` | Sin errores |

La discrepancia de `database/lia/migrations/system-skills-catalog.sql` frente a
`src/shared/skills/registry.ts` permanece fuera de este bloque. Esos archivos y
`scripts/quality/system-skills-seed.mjs` siguen sin diferencias frente a HEAD en
esta rama. No se regeneró SQL fuera de alcance ni se ejecutó `verify:release`.
Inventario actualizado por los valores derivados del validador: 294 archivos
main, 124 renderer y 1 script; 103 canales de navegador, 93 invocables y 10 eventos.

## Prueba visual y nativa

El fixture `test/manual/browser-workspace/main.tsx` ofrece abrir Soporte con
versiones ficticias y cancelación de exportación simulada. Se comprobó en el
navegador de la aplicación a 1280×720: panel completo en claro y oscuro, botones
legibles, cancelación sin éxito falso, Tab desde exportar retorna al cierre y
Escape cierra devolviendo foco a la apertura. No se afirma cobertura general de
accesibilidad ni validación de diálogos nativos por esta prueba. Vite y la pestaña
temporal se cerraron al terminar.

```powershell
npm run browser:smoke:native -- --electron C:\Users\fysg5\AppData\Local\Temp\pulse-browser-smoke-2XqWst\runtime\electron.exe
```

Se reutilizó Electron 43.4.0 aislado, sin instalar dependencias. El runner
transpila nueve módulos; el nuevo caso ejecuta el exportador con BrowserWindow
y filesystem reales, pero consentimiento y selector simulados. Comprueba
versiones efectivas, conteo de descargas, ausencia de URL/nombre de descarga y
conservación del archivo al repetir el destino.

Resultado: **12 comprobaciones de ejercicio + 4 de recuperación aprobadas**.
El smoke continúa parcial por zoom compartido por origen en Electron 43;
runner código 2, npm código 1. Artefactos conservados en
`C:\Users\fysg5\AppData\Local\Temp\pulse-browser-smoke-SCBJc9`, incluido
`diagnostico.json`. No se usaron cuentas reales, agentes, instalador ni `.env`.

## Revisión adversarial y riesgo residual

| Hipótesis intentada | Evidencia y resultado |
|---|---|
| P1: el renderer exporta contenido elegido o usa otro perfil sin HITL | Handler rechaza payload, emisor ajeno, frame faltante/ajeno y falta de sesión; el exportador rechaza scope/generación/ventana/transición/cierre y expiración. Pruebas en `integrated-browser-handlers.test.ts`, `integrated-browser-diagnostic-report.test.ts` y servicio real. |
| P1: el reporte filtra campos extra, URLs o errores | Proyección cerrada y versiones normalizadas; prueba con URLs/token/rutas ficticios y mensaje EACCES. El servicio real recibe pestañas con query y el reporte no las contiene. |
| P1: fallo de escritura destruye el destino o publica parcial | Enlace exclusivo sin reemplazo; destino existente conservado, invalidación durante escritura no publica, fallo de enlace limpia temporal. Comprobado también en Electron estable sobre disco local. |
| P2: conteos inválidos se convierten en actividad inventada | Ceros observados, límites, estados de descarga y relaciones pestañas/vistas validados; fuentes y agregación instantánea explícitas. |
| P2: fallo del bridge deja soporte bloqueado o promesa sin manejar | Se corrigió carga/reintento; pruebas de throw síncrono, cancelación, fallo exportando, doble clic y respuesta tardía tras desmontar. |

No quedan hallazgos bloqueantes conocidos en este bloque. La publicación ya
emitida al filesystem no se puede cancelar; una invalidación posterior no borra
el archivo consentido. Un fallo al limpiar el temporal saneado se registra sin
rutas; no se promete borrado físico ni durabilidad ante apagado. Filesystems
sin enlaces duros fallan con mensaje recuperable; no se probaron discos de red
o todos los sistemas operativos. No se probó interacción humana con los diálogos
nativos ni la aplicación empaquetada. El diagnóstico no garantiza ausencia de
fallos, no conserva una bitácora histórica y no resuelve WhatsApp/organizaciones.

## Reversión y siguientes pendientes

Retirar coherentemente módulo/exportador del servicio, canal/handler, allowlist,
preload, contrato y botón. No hay flag nuevo ni migración de datos; los JSON ya
exportados pertenecen al usuario y no se eliminan al revertir. La consulta de
versiones existente puede conservarse. El checkout original y sus cambios de
organizaciones/WhatsApp no fueron modificados; no hubo commit, PR, merge o deploy.

8.3 se marca completa. Permanecen 35 tareas globales: entre ellas importación de
historial/credenciales, autenticación del SO, perfiles privados, zoom aislado,
agente avanzado y sync. Las compuertas de cierre global siguen abiertas.
