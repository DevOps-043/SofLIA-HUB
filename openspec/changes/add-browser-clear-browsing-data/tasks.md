## 1. Almacenes del perfil

- [x] 1.1 Añadir `BrowserHistoryStore.clearSince`, que acota por fecha, devuelve cuántas visitas quitó y rechaza una fecha inválida antes de escribir.
- [x] 1.2 Añadir `BrowserCredentialVault.clearAll`, que vacía la bóveda del perfil sin exigir origen y sin descifrar nada.
- [x] 1.3 Añadir `BrowserSitePermissionStore.clearAll`, conservando `clear()` para no alterar a sus llamadores.
- [x] 1.4 Cubrir con pruebas main el rango, el borde exacto del intervalo, el historial vacío y la fecha inválida.

## 2. Orquestador del borrado

- [x] 2.1 Crear `electron/integrated-browser/browsing-data.ts` con categorías, intervalos, `rangeStartIso` y `validateBrowsingDataRequest`.
- [x] 2.2 Implementar `clearBrowsingData` con dependencias inyectadas, marca `ignoredRange` y fallo aislado por categoría con error saneado.
- [x] 2.3 Cablear `IntegratedBrowserService.clearBrowsingData` sobre la partición del perfil activo, separando datos de sitio de la caché y añadiendo `clearAuthCache`.
- [x] 2.4 Cubrir con pruebas main la validación, cada categoría, la degradación del intervalo y el fallo aislado.

## 3. Electron e IPC

- [x] 3.1 Registrar el handler `integrated-browser:clear-browsing-data` con verificación de emisor y error saneado.
- [x] 3.2 Completar allowlist de canales, API de preload y wrapper tipado del renderer.
- [x] 3.3 Actualizar las guardas de conteo del contrato del navegador y añadir la aserción del canal nuevo.

## 4. Experiencia en el navegador

- [x] 4.1 Implementar `BrowserPrivacyPanel` con categorías, intervalo, aviso de alcance, confirmación y resumen por categoría.
- [x] 4.2 Añadir la pestaña "Privacidad" al panel de administración y su entrada en el menú de herramientas.
- [x] 4.3 Cubrir con pruebas renderer la selección inicial, la confirmación obligatoria, el payload enviado, el aviso de alcance, el resumen y el fallo aislado.

## 5. Documentación y cierre

- [x] 5.1 Actualizar `docs/architecture/ipc-and-integrations.md`, `docs/product/functional-requirements.md` (RF-041), `docs/product/user-stories.md` (HU-027), `docs/product/traceability-matrix.md`, `docs/security/security-and-privacy.md` y `docs/quality/test-strategy-and-inventory.md`.
- [x] 5.2 Ejecutar pruebas focalizadas, `npm run typecheck`, lint del código cambiado, validación documental y validación OpenSpec.
- [ ] 5.3 Verificación manual en el host: iniciar sesión en un sitio, borrar cookies y comprobar que la sesión cayó; comprobar que el historial anterior al intervalo sobrevive; comprobar que el perfil de otra cuenta queda intacto.
- [ ] 5.4 Ejecutar `npm run verify:pr` y revisión adversarial de destructividad, alcance de perfil, HITL y ausencia de acceso del agente.
