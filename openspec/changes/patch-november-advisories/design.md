## Context

systeminformation es dependencia directa. follow-redirects llega por la cadena
de imágenes de nut-js/Jimp. La reproducción local en la versión instalada
confirma que una lista de cabeceras de otro contexto de JavaScript pierde la
protección al redirigir a un segundo puerto.

## Decisions

Usar versiones publicadas corregidas de las líneas compatibles. Resolver primero
el lock sin scripts, revisar el delta e instalar sin ejecutar ganchos. Conservar
los contratos de procesamiento de imágenes, documentos y herramientas.

## Risks / Trade-offs

Una auditoría verde no acredita ausencia de vulnerabilidades. No elevar mayores
de transitivas sobre consumidores antiguos para silenciar avisos. Los parches
deben conservar el contrato real de sus consumidores.

## Migration Plan

Comparar auditoría inicial/final, comprobar lock y árbol instalado, ejecutar
contratos y compuerta. Restaurar sólo esta unidad desde los respaldos si falla,
preservando los cambios de retirada del proveedor y demás trabajo existente.
