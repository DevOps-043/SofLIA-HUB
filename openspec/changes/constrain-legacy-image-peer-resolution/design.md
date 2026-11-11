## Context

Ver propuesta y Context Pack. nut-js/shared 4.2.6 fijan Jimp 0.22.10; sus plugins
0.22.12 declaran peers >=0.3.5. Scale resuelve resize 1.6.1 y shadow resuelve
blur/resize 1.6.1, aunque el conjunto activo de plugins Jimp es 0.22.12. El
constructor actual funciona: no se adjudica un fallo de producto no observado.

## Goals / Non-Goals

**Goals:** cerrar la resolución ambigua, retirar subárbol vulnerable innecesario
y proteger APIs del consumidor con contratos de datos reales.

**Non-Goals:** migrar las APIs de Jimp/nut-js, forzar Zod 4 sobre consumidores 3,
ejecutar escritorio/cuentas o declarar seguridad de todo el árbol/instalador.

## Decisions

- Overrides limitados a `@jimp/plugin-scale@0.22.12` y
  `@jimp/plugin-shadow@0.22.12`: peers resize/blur 0.22.12 del mismo conjunto.
  Las dependencias normales ya usan esa versión. Un override global de Zod 4
  o Jimp 1 cruza una frontera de API y no satisface compatibilidad.
  La [guía oficial de migración Jimp](https://jimp-dev.github.io/jimp/guides/migrate-to-v1/)
  documenta cambios de exports, argumentos y nombres de métodos en v1.
- Conservar file-type 16 sin ocultar su aviso: su consumidor usa fromBuffer,
  mientras la versión parcheada actual cambió API/exportaciones. Downgradear
  a una línea antigua sin demostrar soporte o introducir un fork local sin
  mantenimiento no forma parte de esta corrección. Referencias:
  [file-type](https://github.com/advisories/GHSA-5v7r-6r5c-r473) y
  [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Contratos de tooling ejecutados por test:quality: resolver peers desde sus
  padres reales; probar Jimp desde ambos consumidores y proveedores de nut-js,
  con buffers/píxeles y archivos propios, errores y formatos. Compartir esos
  contratos con un runner Electron en modo Node, sin BrowserWindow ni captura.
  Es independiente de la revisión visual bloqueada de la confirmación.
- Generar lock sin scripts y revisar delta antes de instalación física también
  sin scripts. Comparar versiones/SRI/ganchos y paquetes afectados antes/después;
  no audit fix ni supresiones. No ampliar los pins fuera del cierre identificado.
- Mantener rama acumulativa; los demás worktrees y cambios existentes pertenecen
  a trabajo distinto. Respaldos propios de manifiesto/lock y logs en TEMP.

## Risks / Trade-offs

- Peer satisfecho por versión con API incompatible → pruebas desde cada padre,
  exports invocables, resize/blur/scale y color/RGB/BGR de datos sintéticos.
- Instalación física divergente del lock → inventario/SRI y contratos después
  de instalar; fallo no equivale a omitido.
- Paquetes quitados siguen físicamente alcanzables → resolver y comprobar árbol
  físico; no basta un diff del lock o audit aislado.
- Riesgo file-type continúa → registrar residual y exigir migración/backport
  mantenido compatible en trabajo posterior, sin afirmar parser seguro.
- Sin otros SO, Node 24 ni revisión independiente → declarar límites, no archivar.

## Migration Plan

Auditoría/base física; contratos rojos de peers; lock candidato y revisión de su
delta; instalación/contratos/auditoría; docs, autorrevisión y gate/build congelados.
Retirar overrides cuando los padres corrijan peers o el consumidor migre fuera
de esta API, con los mismos contratos y auditoría. Recuperación selectiva conserva
manifiesto/lock coherentes: corregir la resolución y reinstalar sin reactivar
subárboles vulnerables sólo para conseguir un verde. Sin datos migrados.
