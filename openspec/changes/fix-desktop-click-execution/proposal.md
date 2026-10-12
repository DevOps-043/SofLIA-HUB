## Why

El usuario probó el acompañamiento en el escritorio: el orbe mostró una indicación y Computer Use anunció una nota escrita sin abrir Bloc de notas ni completar la tarea. La prueba anterior comprobaba superficies, no entrada física. El loop acepta texto terminal después de errores y el driver descarta acciones no soportadas sin error.

## What Changes

- Propagar fallos de entrada y acciones no soportadas; impedir éxito después de un error pendiente.
- Conservar coordenadas de type_text_at y compatibilidad de nombres de acciones.
- Corregir carga del backend nativo en módulos ESM y hotkeys Windows en fallback.
- Esperar asentamiento visual y comprobar evidencia al terminar tareas de escritorio.
- Probar clic y escritura físicos sobre una ventana local de QA usando el ejecutor del producto.

## Capabilities

### New Capabilities
- `desktop-cu-execution-evidence`: ejecución verificable y cierre sin falso éxito.

## Impact

Driver/loop de Computer Use, controles de entrada y pruebas. Sin claves nuevas, permisos adicionales ni cambios remotos. Conservar aprobaciones y cancelación existentes.
