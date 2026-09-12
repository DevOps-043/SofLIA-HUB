# Gobierno del agente visual: carreras y cancelación

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Estado: tarea 6.2 implementada y verificada. No es release ni despliegue.

## Cambios

El driver del navegador fija al construir la tarea la pestaña, vista, ventana,
perfil, política y estado de control. Cada captura fija además URL y revisión
visual. Una navegación, cambio de pestaña (aunque se vuelva a la anterior),
cambio de perfil, revocación de política o liberación del control invalida el
contexto. El DOM, la captura marcada y las coordenadas obsoletas no se mezclan
con la URL actual; la navegación propia se revalida antes de cargar y obliga a
una captura nueva.

`AbortSignal` cruza el loop y el driver. Se revisa antes y después de permisos,
capturas, marcado SoM, escritura, esperas y respuestas del proveedor. Un aviso
cancelado se retira y una aprobación tardía no persiste el permiso. No se emite
Enter, no se recaptura y no se vuelve a llamar al modelo después de cancelar.
Un motivo arbitrario de cancelación nunca se propaga al usuario o al modelo.

## Evidencia

```powershell
npm run test -- integrated-browser-cu-driver integrated-browser-service gemini-cu-loop desktop-agent-computer-use-lifecycle
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --maxWorkers=1
npm run typecheck
npm run lint:changed
git diff --check
```

Resultado: suites focalizadas **5 archivos / 119 pruebas aprobadas**; regresión
ampliada **56 archivos / 636 pruebas aprobadas**; TypeScript y lint aprobados
(89 archivos revisados). `verify:pr` alcanzó adaptadores, arnés, suministro,
documentación y enlaces, y quedó bloqueado por la discrepancia preexistente de
`database/lia/migrations/system-skills-catalog.sql` frente a
`src/shared/skills/registry.ts`; esos archivos permanecen sin cambios.

## Límites restantes

La cancelación no puede deshacer una entrada que Chromium ya recibió ni cortar
una petición ya enviada al proveedor de IA. Tampoco implementa por sí sola la
UI y el contrato completos de detener, pausar y tomar control; eso permanece en
6.4. No se afirma cobertura de mutaciones autónomas de una SPA entre capturas,
ni smoke completo del producto empaquetado.
