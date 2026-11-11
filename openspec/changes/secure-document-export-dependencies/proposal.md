## Why

ExcelJS 4.4.0 conserva uuid 8.3.2 afectado; PptxGenJS 4.0.1 declara image-size
1.2.1 afectado, aunque sus bundles no lo importan. Los padres actuales no ofrecen
un cierre corregido y requieren compatibilidad demostrada antes de sustituir
transitivas mayores, sin rebajar los generadores funcionales.

## What Changes

- Fijar los padres instalados y acotar overrides a esas versiones: uuid 11.1.1
para ExcelJS e image-size 2.0.4 para PptxGenJS.
- Probar defectos con fixtures pequeños protegidos y contratos CJS/ESM/archivo.
- Generar/releer documentos reales con imágenes, gráficas y formato condicional
en Node/Electron; mantener regresiones en el gate.
- Documentar motivo, límites y retiro del override cuando cambie el padre,
auditoría comparable y verificación completa.

## Capabilities

### New Capabilities

Ninguna; skip_specs=true por mantenimiento de dependencias sin nuevas APIs.

### Modified Capabilities

Ninguna; formatos, autorización y cuatro capas públicas conservan contratos.

## Impact

Manifiesto/lock, pruebas y tooling QA, política documental y plan de deuda.
No cambia SQL, secretos, permisos, modelos o servicios externos. No se publica
ni instala una distribución del producto, y no se presupone exposición del Hub
a una función vulnerable que su consumidor no llama.
