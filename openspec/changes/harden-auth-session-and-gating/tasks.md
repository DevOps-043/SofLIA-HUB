## 1. Persistencia de sesión robusta

- [x] 1.1 Clasificar el resultado de `resolveSofiaContext` en denegación real vs. error recuperable. — Tipo `SofiaContextResolution` (`ok`/`denied`/`error`) en `src/contexts/auth/types.ts`. Causa raíz: `fetchSofiaUserProfile` devuelve `null` al fallar (traga el error), indistinguible de "sin membresía"; se distingue porque un perfil válido sin membresías devuelve objeto con `memberships: []`, no `null`.
- [x] 1.2 No ejecutar `signOut()` ante error recuperable: conservar sesión, degradar y reintentar con backoff. — `useSofiaResolver.ts` (3 intentos, backoff 400/800 ms) y `useAuthLifecycle.ts` (`applySofiaSession` con los 3 casos).
- [x] 1.3 Pruebas del lifecycle. — `src/__tests__/contexts/auth-context/session-persistence-cases.tsx`: AUTH-010 fallo transitorio mantiene sesión (no `signOut`, degradado, reintenta), AUTH-011 sin membresía cierra sesión (sin reintento), AUTH-012 restauración válida. 9/9 verdes.

## 2. Estado de auth conocido por el main (IPC gobernado)

- [x] 2.1 Contrato tipado `{ authenticated, userId }` sin tokens ni PII. — `electron/main/auth-state.ts`.
- [x] 2.2 Handler `auth:set-state`/`auth:get-state` con validación de payload; store con valor inicial `no autenticado`. — `electron/auth-state-handlers.ts`, registrado en `bootstrap.ts` antes de crear la ventana.
- [x] 2.3 Canal en la allowlist del preload + wrapper tipado. — `preload/channel-group-1.ts`, `preload/auth-apis.ts`, `src/services/auth-state.ts`.
- [x] 2.4 Publicar el estado desde el renderer en login, logout y restauración. — efecto en `useAuthProviderModel.ts`; solo la ventana principal publica y nunca durante `loading` (evita un `false` transitorio que revocaría el acceso).

## 3. Deny-by-default en superficies del main

- [x] 3.1 Guard central que devuelve `auth_required` sin efectos cuando no hay sesión. — `electron/main/require-auth.ts`.
- [x] 3.2 Gatear creación/visualización de la orbe. — gate dentro de `createOrbWindow`, que cubre wake word, atajo global y tray en un solo punto.
- [x] 3.2b Gatear detección de reuniones (bypass observado en evidencia). — `meeting-live/meeting-detector.ts` (`poll`) y `meetings/meeting-passive-detection-service.ts` (`runScanNow`).
- [x] 3.3 Gatear autoconexión y acciones de WhatsApp. — gate en `connect()` de `electron/whatsapp/service.ts` (cubre autoconexión y conexión manual). El lint preexistente se resolvió con un `eslint-disable` justificado: `useMultiFileAuthState` es de Baileys, no un hook de React.
- [x] 3.4 Gatear handlers de computer-use y desktop-agent. — computer-use: `executeToolDirect` en `computer-use/tool-dispatch.ts` (punto único de todas las herramientas). desktop-agent: `execute-task` y `execute-parallel` en `task-handlers.ts` y las 7 primitivas de mouse/teclado vía `handleGuardedPrimitive`. Exentos por informativos: status, observación y calibración del desktop-agent.
- [x] 3.5 Al `authenticated:false` (logout), cerrar la orbe. — suscripción en `orb-window-controller.ts`.

## 4. Coherencia del renderer y arranque

- [x] 4.1 La ventana orbe consume el gate pero no publica estado. — `isOrbWindowRenderer()` en `src/services/auth-state.ts`.
- [x] 4.2 Diferir en el arranque la autoconexión de WhatsApp hasta `authenticated:true`. — `electron/main/whatsapp-auth-gate.ts`: reintenta la autoconexión al iniciar sesión y desconecta al cerrarla, para que el gate no deje WhatsApp inservible.
- [x] 4.3 Bandera de reversión del gate. — `SOFLIA_DISABLE_AUTH_GATE=1`.

## 5. Verificación y cierre

- [ ] 5.1 Pruebas de contrato del canal IPC (payload válido, inválido, denegado) y del guard (permitido/denegado/logout).
- [ ] 5.2 `npm run typecheck`, `lint:changed`, pruebas dirigidas y `npm run verify:pr`.
- [ ] 5.3 Actualizar documentación de IPC/arquitectura y parámetros de runtime afectados.
- [ ] 5.4 Revisión adversarial: bypass del gate (wake word, atajo, tray, autoconnect), falsificación del estado, fallo transitorio que no debe cerrar sesión, revocación al logout y rollback; adjuntar evidencia.
