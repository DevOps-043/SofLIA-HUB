# Verificación del logo de organización

Estado: implementación completada; verificación focalizada correcta y
excepciones ajenas al alcance en el workspace principal.
Fecha: 2026-11-11.

## Diagnóstico confirmado

`AppSidebar` y las filas de `UserMenu` seleccionaban exclusivamente
`brand_favicon_url`. El contrato y la consulta del perfil ya incluyen `logo_url`.
Cuando faltaba el favicon no se intentaba el logo; el acceso podía mostrar la
foto personal. Además se añadía una máscara circular o caja al logo. No se
consultaron cuentas ni URLs de organizaciones reales: el diagnóstico describe
la ruta de código, sin atribuir un formato concreto al archivo de Empresa Demo.

## Resultado

- Acceso con logo de organización y nombre accesible; el selector mantiene los
  nombres visibles. Sin organización se conserva el acceso personal existente.
- Logo principal, después favicon y finalmente inicial; se ignoran candidatos
  vacíos y duplicados y se reinician intentos al cambiar identidad o URLs.
- Ajuste proporcional sin fondo, borde, sombra ni máscara añadidos; acceso
  expandido de hasta 144 × 40 px y compacto/filas de 32 × 32 px.
- Se preservaron los cambios concurrentes de iconografía, diálogo, Escape y
  apariencia presentes en el workspace. La prueba existente de apariencia se
  adaptó al nuevo nombre accesible del acceso de organización.

## Evidencia

- `npm run test -- src/__tests__/components/OrganizationLogo.test.tsx src/__tests__/components/UserMenu.test.tsx src/__tests__/components/Sidebar.test.tsx`: 23 pruebas correctas en el worktree aislado.
- Las anteriores más `src/__tests__/components/settings-interaction.test.tsx`:
  28 pruebas correctas en el workspace principal en la última ejecución, tras
  integrar los cambios y cubrir organizaciones con el mismo nombre y URL.
- `node test/manual/organization-menu/verify.mjs`: 18 combinaciones correctas
  de tema claro/oscuro, logo vertical/horizontal/cuadrado y barra expandida,
  compacta/inferior. También verifica recuperación tras errores y selección.
  Capturas de ambos temas inspeccionadas visualmente, en `tmp/organization-menu`
  (artefactos locales ignorados, sin versionar). Prueba repetida en el workspace
  principal con `ORGANIZATION_MENU_PREVIEW_URL=http://127.0.0.1:4332`.
- `npm run verify:pr` en el worktree aislado: correcto, incluidos typecheck,
  lint incremental, arnés, documentación, OpenSpec y suite completa:
  527 archivos aprobados y 2 omitidos; 5986 pruebas aprobadas y 5 omitidas en
  la ejecución final, incluyendo el cambio entre organizaciones con igual marca.
  Se enlazaron las dependencias locales existentes de raíz y Zoom dentro del
  worktree, sin instalaciones ni modificaciones de archivos de dependencias.
- `npm run docs:inventory:sync`: inventario recalculado por el script oficial,
  conservando la documentación concurrente del workspace.
- ESLint directo de los 11 archivos de código y verificación afectados:
  correcto, sin errores ni advertencias.
- `npm run verify:pr` en el workspace principal: pasan adaptadores, arnés,
  supply chain, documentación de sistema, enlaces, semilla, OpenSpec, pruebas
  de calidad y typecheck. Se detiene en `lint:changed` con 9 errores y una
  advertencia de cambios ajenos al alcance que ya estaban en el workspace:
  `src/__tests__/app/useAppViewHandlers-deleteFolder.test.ts`,
  `src/app/AppModals.tsx` y
  `src/components/folder-modals/DeleteFolderModal.tsx`. No ejecuta la suite
  completa en este workspace; no se corrigieron ni descartaron esos cambios.
- `npm run typecheck` repetido después de los últimos cambios: detecta un
  cambio concurrente ajeno al menú en
  `src/__tests__/components/update-release-history.test.tsx:200`, que usa
  `String.replaceAll` fuera de la librería objetivo de TypeScript. La ejecución
  anterior dentro de `verify:pr` había pasado. La copia aislada verifica los
  tipos de este cambio sin esa modificación concurrente.

## Reproducción visual

Ejecutar `npx vite --config test/manual/organization-menu/vite.config.mts` y,
en otra terminal, `node test/manual/organization-menu/verify.mjs`. El verificador
usa Edge headless, bloquea destinos externos y usa marcas SVG sintéticas.

## Límites y reversión

No se modifican archivos originales ni datos remotos, permisos, consultas o
canales IPC. No se eliminan márgenes/fondos que ya formen parte de la imagen.
Una URL inválida o inaccesible termina en favicon o inicial, sin foto personal.
Revertir únicamente los cambios de identidad del menú restaura la presentación
anterior; conservar las modificaciones concurrentes de iconografía y ajustes.
