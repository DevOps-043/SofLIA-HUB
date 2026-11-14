# Consolidación directa en main

Fecha: 2026-11-14. Solicitud explícita: unir todo en main sin crear más ramas.

## Inventario y conservación

Se inspeccionaron todas las ramas locales, referencias remotas actualizadas con
`git fetch origin` y worktrees registrados. Todos sus commits ya eran ancestros
de `855192c3`, tanto en main como en origin/main. No había commits divergentes
pendientes de merge. Los únicos cambios sin commit estaban en el checkout
principal y en las dos copias de trabajo de aislamiento y marca.

Se comprobó que el código de esas copias ya estaba integrado en el checkout
principal, normalizando únicamente finales de línea para comparar. Las cuatro
diferencias de documentación conservan las adiciones de voz y el inventario
combinado. El branding coincide íntegramente. Se cambió directamente a la rama
main existente conservando índice y archivos; no se creó ninguna rama.

El conjunto incluye aislamiento/persistencia de chats, continuidad de
Presentaciones en main y procedencia del monitor, marca SofLIA Hub/Academy,
preparación automática y consentimiento de voz y los cambios existentes de
distribución/reparación firmada de Windows. No se archivan especificaciones ni
se declara terminado el despliegue de firma real pendiente de credenciales.

## Ajustes de integración

- ESLint aplica el ámbito Node CommonJS ya existente a
  `electron-builder.windows.cjs`. El archivo sigue siendo analizado; no se
  excluye del lint ni se modifica para cambiar su comportamiento.
- La prueba del preparador empaquetado comprueba delegación al motor firmado
  en Windows y conserva el destino del preparador en las otras plataformas.
  Una firma rechazada no deriva a ejecución/instalación sin firma.
- Las pruebas del paquete incluyen ahora el modelo Vosk básico requerido por
  la distribución. Se comprueba también que su ausencia bloquea el empaquetado
  antes de invocar Python, en vez de retirar esa comprobación del producto.

## Verificación

- Pruebas de chats, acceso y contratos integrados: 19 archivos, 176 casos
  aprobados, según [verificación del arreglo](verification.md).
- Voz en el conjunto consolidado: 5 archivos, 79 casos aprobados.
- Suite completa del conjunto: 653 archivos; 648 aprobados, 3 fallidos y
  2 omitidos. 7,619 casos aprobados, 8 fallidos y 5 omitidos (7,632 casos,
  176.49 s). Tres fallos eran las expectativas antiguas del inventario del
  modelo en `verify-packaged-python`; se corrigieron después y su ejecución
  dirigida junto al preparador pasa con 27 casos, incluyendo tres negativos
  nuevos. Los otros cinco son los fallos preexistentes de MSAL/Zod registrados
  en la verificación anterior. No se presenta esa suite como globalmente verde
  ni como una nueva ejecución completa posterior al ajuste de los tests.
- `npm run lint:changed`: el conjunto pasa sin deuda nueva; la comprobación
  previa a ajustar el inventario de modelos revisó 109 archivos.
- Arnés válido: 25 rutas y 10 skills. Documentación: 1110 enlaces/documentos
  activos válidos; inventario de sistema válido con 850 archivos de prueba.
- Los tres cambios OpenSpec implicados pasan validación estricta.
- TypeScript node aprobado. El proyecto principal conserva los tres TS2353 de
  Calendar por MSAL instalado distinto de la versión fijada.
- `npm run verify:pr` aprueba adapters, arnés, supply-chain e integridad CI y
  se detiene en `runtime:stable`: Electron instalado 44.5.1 frente a 44.9.3.
  No se omiten hooks ni compuertas para publicar.

La firma pública, dictado con hardware e instalador final no se certifican por
esta consolidación. No se leen/cambian secretos ni políticas de Windows, ni se
modifican datos remotos de los chats. Las copias de trabajo previas se conservan.

## Reversión

Usar un revert del commit de consolidación si fuese necesario, sin resetear ni
reescribir main remoto. Mantener datos locales, colas, workspaces y artefactos.
Las ramas históricas ya contenidas en main no necesitan volver a fusionarse.
