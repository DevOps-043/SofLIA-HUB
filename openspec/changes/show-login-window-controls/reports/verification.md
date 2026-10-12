# Verificación de los controles del acceso

Fecha: 2026-10-10. Estado: corrección aplicada en el checkout principal;
verificación focalizada satisfactoria, gate global bloqueado por incidencias
ajenas al cambio.

## Implementación

`src/components/auth/AuthChrome.tsx` monta `AppTitleBar`, que ya incluye
`WindowControls`, su región de arrastre y la API preload existente. La barra
queda fuera del contenido desplazable. La tarjeta se centra con márgenes
automáticos y conserva su altura al reducir la ventana.

La implementación se aisló en `.worktrees/login-window-controls`, rama
`codex/login-window-controls`, y se integró mediante un parche comprobado con
`git apply --check`. Se conservaron los cambios ajenos del checkout principal.
No se modificaron autenticación, handlers, allowlists ni contratos IPC.

## Resultados

| Comprobación | Resultado |
|---|---|
| `npm run test -- --project renderer src/__tests__/components/Auth.test.tsx` | 9 pruebas pasan, tanto en aislamiento como en el checkout principal |
| `npm run typecheck` | Pasa en ambos checkouts |
| `npm run lint:changed` | Pasa; 2 archivos en aislamiento y 36 en el checkout principal, sin incidencias nuevas |
| `npm run docs:check` | Pasa en el checkout principal: 379 documentos, incluido este reporte |
| `npm run harness:validate` | Pasa durante ambos gates |
| `npx openspec validate show-login-window-controls --type change --strict --no-interactive` | Pasa en ambos checkouts |
| `git diff --check` sobre los tres archivos modificados | Pasa |
| Vista aislada con Vite y Playwright/Edge | Pasa en claro y oscuro a 1262 × 857, y en ventana de 800 × 360 |

Las pruebas cubren controles visibles sin sesión, minimizar/cerrar sin enviar ni
borrar el formulario, maximizar/restaurar y actualización ante eventos nativos
de tamaño. La vista automatizada comprobó regiones `drag`/`no-drag`, posición de
la barra, centrado de la tarjeta, los cuatro clics y desplazamiento hasta el pie
del formulario en poca altura. Las tres capturas se revisaron visualmente.
El puente Electron se simuló para esta vista; sus handlers existentes no cambian.
El harness y las capturas se conservan en el `tmp/login-window-preview/` ignorado
del worktree aislado.

## Límites de la verificación global

- `npm run verify:pr` en aislamiento falla en la especificación preexistente
  `launch-learning-live-sessions`: sus encabezados de requisitos en HEAD carecen
  del formato `### Requirement:`. La nueva especificación sí pasa.
- `npm run verify:pr` en el checkout principal falla en `docs:system:check`: el
  catálogo IPC no coincide con los 445 canales derivados de los otros cambios
  presentes. Esta corrección no añade ni modifica canales.
- Se iniciaron dos ejecuciones de la suite completa, una con concurrencia
  predeterminada y otra con `--maxWorkers 2`. Se interrumpieron sin un resumen
  concluyente; no se declara que la suite completa haya pasado.

El intro de arranque mantiene su overlay temporal y la orbe no usa este layout.
No se generó un instalador. Para revertir la corrección basta con retirar la
barra y restaurar el layout anterior de `AuthChrome`.
