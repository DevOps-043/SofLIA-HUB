# Evidencia de cambio de marca

Fecha: 2026-10-13. Estado: implementación incorporada y verificada tanto en el
worktree aislado como en el checkout de trabajo del usuario.

## Resultados

- `npm run typecheck`: correcto.
- `npm run harness:validate`: correcto, 25 rutas y 10 skills.
- `npm run docs:check`: correcto, 518 archivos Markdown activos.
- `npm run docs:inventory:sync`: inventario sincronizado con las dos pruebas nuevas.
- `npm run skills:seed`: semilla local sincronizada tras renombrar los prompts;
  no se ejecutó SQL remoto.
- Pruebas focalizadas de perfil, assets, instaladores, smoke de empaquetado,
  navegador y pestañas: 152 pruebas correctas en 7 archivos.
- `npm run installer:test:native`: 33 comprobaciones correctas; motor inocuo,
  sin instalar ni ejecutar la aplicación.
- `npm run verify:pr`: correcto en el worktree aislado, 423 archivos de prueba
  correctos y uno omitido; 4343 pruebas correctas y una omitida. También pasaron
  adaptadores, Arnés, supply chain, documentación, semilla, OpenSpec, typecheck y lint.
- `npm run verify:pr` en el checkout del usuario: correcto, 423 archivos de prueba
  correctos y uno omitido; 4346 pruebas correctas y una omitida. Incluye el ajuste
  de primera instalación y los cambios concurrentes de Live Studio presentes
  al ejecutar la suite. Incorporación: 240 archivos; no se sobrescribieron cambios
  concurrentes ajenos a la marca.
- Comprobación de píxeles: el PNG versionado coincide exactamente con el recorte
  del PNG entregado, sin cambios de color, figura ni canal alfa.

## Revisión visual y compatibilidad

Se renderizaron los componentes reales AuthLogo y BrowserHomePage en Chrome,
temas claro/oscuro, 1440 × 900 y 900 × 600. Los cuatro logos cargaron, no hubo
errores JavaScript y el logo no se superpuso al encabezado ni al buscador.
Se inspeccionó además el sidebar generado del instalador; nombre completo y logo
sin recorte. La figura original, sus colores y la transparencia se conservan.

Se intentaron refutar pérdidas de perfil, claves de cifrado y contratos SSO:
el perfil queda fijado antes de setName; appId, repositorio de actualización,
cabecera SSO, contexto autenticado de la bóveda y claves persistidas no cambian.
El shell rechaza carpetas incompletas, acepta la pareja ejecutable/desinstalador
anterior y nueva y comprueba ambos nombres de proceso. No se añadieron permisos.
Se comprobó además el contrato local de `app.setPath`: requiere que el destino
exista. El arranque crea la carpeta de forma idempotente antes de configurarla,
y las tres pruebas de perfil cubren primera instalación, desarrollo y conservación
de archivos previos.

Los primeros checks detectaron inventario desactualizado y semilla divergente;
se regeneraron desde sus fuentes y la compuerta completa pasó después.
La fixture visual temporal se retiró al completar su revisión.

## Estado previo y límites

Se preservaron los cambios previos de Live Studio. El worktree se preparó con
una copia del estado local para verificar las mismas fuentes. La incorporación
usa una captura de los archivos modificados por marca y rechaza sobrescribir
archivos que cambiaron después de esa captura. Los cambios concurrentes de
StudioPreview, useStudioScenes y StudioProduction quedan fuera de la incorporación.

No se publicaron releases ni se instalaron paquetes de aplicación. No se ejecutó
`verify:release`; quedan pendientes los smoke de paquetes y actualización real en
Windows/macOS/Linux propios de un candidato de release. La reversión se documenta
en [identidad](../../../../docs/product/brand-identity.md).
