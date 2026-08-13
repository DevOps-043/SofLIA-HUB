# Verificación

Fecha: 2026-08-12. Host: Windows 11.

## Compuertas ejecutadas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | Sin errores |
| Pruebas main | `npx vitest run --project main` | 110 archivos, 1262 casos, todos en verde |
| Pruebas renderer | `npx vitest run --project renderer --exclude "**/BrowserAppGridMenu.test.tsx"` | 81 archivos, 606 casos, todos en verde |
| Lint del código cambiado | `npx eslint` sobre los archivos de este cambio | Sin hallazgos propios |
| Documentación de sistema | `npm run docs:system:check` | 28 documentos, 150 IDs, 344 canales, 367 archivos de prueba |
| Enlaces de documentación | `npm run docs:check` | 187 archivos válidos |
| OpenSpec | `npm run openspec:validate` | 17 de 17 cambios válidos |

## Cobertura nueva

40 casos nuevos: 31 en main y 9 en renderer.

- `integrated-browser-browsing-data.test.ts` (22): traducción de cada rango a un inicio concreto; rechazo de categoría desconocida, rango desconocido, lista vacía y payload nulo; deduplicación de categorías; acotado del historial y borrado total con rango `todo`; marca `ignoredRange` en cookies y caché y su ausencia con rango `todo`; conteo de contraseñas y permisos; aislamiento de las categorías no pedidas; fallo aislado con las demás borrándose igual; saneamiento del error; conservación del rango en el resumen.
- `browser-history-clear-range.test.ts` (6): contra el sistema de archivos real, conserva lo anterior al inicio y quita lo posterior; borra todo con rango nulo; no quita nada fuera de rango; devuelve cero sobre historial vacío; rechaza fecha inválida sin escribir; incluye la visita justo en el límite.
- Ampliación de `integrated-browser-handlers.test.ts` y `preload/channel-cases.ts` (3): el canal se registra, enruta un payload válido, devuelve error ante lista vacía, y las guardas de conteo del contrato del navegador suben a 51 handlers y 57 canales.
- `BrowserPrivacyPanel.test.tsx` (9): selección inicial equivalente a Chrome; confirmación obligatoria antes de cualquier llamada; payload exacto de categorías e intervalo; aviso de alcance presente solo cuando hay discrepancia real y ausente cuando solo se pide historial; botón deshabilitado sin categorías; resumen distinguiendo conteo de "sin acotar al intervalo"; fallo aislado visible; error del canal sin dejar el diálogo colgado.

## Hallazgos preexistentes, no introducidos por este cambio

- `src/__tests__/components/BrowserAppGridMenu.test.tsx` sigue colgando la suite renderer de forma indefinida; se excluyó para obtener señal. Diagnosticado y documentado en el cambio `add-desktop-app-context-attachments`.
- `react-hooks/set-state-in-effect` en `BrowserManagementPanel.tsx` (2 ocurrencias) y `IntegratedBrowserPanel.tsx` (1). Presentes en HEAD con el mismo texto.
- `preserve-caught-error` en `credential-vault.ts`, dentro del `catch` de `read()`. Es la línea 113 en HEAD; solo cambió de número al insertarse `clearAll` encima.

## Pendiente

- Verificación manual en el host: iniciar sesión en un sitio, borrar cookies y comprobar que la sesión cayó; comprobar que el historial anterior al intervalo sobrevive; comprobar que el perfil de otra cuenta queda intacto. Las pruebas cubren el orquestador con dependencias inyectadas y el historial contra disco real, pero **no ejercitan `session.clearData`, `clearCache` ni `clearAuthCache`**: eso exige una partición de Chromium viva.
- `npm run verify:pr` y revisión adversarial, bloqueados por el cuelgue preexistente de la suite renderer.
