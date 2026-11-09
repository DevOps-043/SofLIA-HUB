## Why

El backend GUI concatena texto en shell/intérpretes, confunde escritura literal
con teclas especiales y deja procesos sin límites. OCR lee words/lines que no
corresponden a Page de Tesseract 7 y no termina el worker si reconocer falla.

## What Changes

- Separar scripts fijos, argumentos/datos y transporte de procesos sin shell.
- Validar acciones/coordenadas y combinaciones de teclas; conservar funciones.
- Acotar duración/salida y retener ejecución hasta cierre físico del proceso.
- Revalidar fuente/sesión tras captura/OCR y antes de actuar; cancelar procesos.
- Leer blocks de Tesseract 7 con limpieza comprobada y sin capturas tras revocar.

## Capabilities

### New Capabilities
- `computer-gui-backends`: ejecución GUI tipada y OCR vigente, sin código del usuario.

### Modified Capabilities
Ninguna especificación canónica modificada.

## Impact

Servicio GUI, dispatcher/contexto main y handler existente; sin nuevos canales,
dependencias ni políticas de permisos. Backends Windows/macOS/Linux simulados,
documentación y evidencia local; no se inicia GUI ni se verifica hardware real.
