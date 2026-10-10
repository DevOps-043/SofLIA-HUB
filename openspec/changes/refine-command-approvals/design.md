## Context

El renderer confirma operaciones con un handler booleano y usa el diálogo nativo como fallback. Main conserva validateCommandSafety; una preferencia de UI nunca autoriza comandos bloqueados. Los lotes evitan sobrescritura mediante resolveCollision y registran undo.

## Decisions

- Ampliar el resultado del handler a boolean | 'always', compatible con consumidores existentes. Sólo comandos locales no sensibles ofrecen Siempre permitir.
- Persistir huellas SHA-256 del comando exacto, herramienta y directorio en preferencias del usuario. No persistir texto de comandos ni conceder permisos globales. Si storage/crypto fallan, conservar aprobación única; si cambia el usuario durante el diálogo, denegar.
- Ofrecer revocación de todas las huellas del usuario activo en Privacidad y Gobernanza, independiente de la disponibilidad del sidecar Python.
- Reconocer conservadoramente cambios de entorno, registro, privilegios, servicios, sistema, borrado y ejecución compuesta/ofuscada; nunca recordar su aprobación. Herramientas de archivos declaradas y reversibles no requieren modal.
- Rechazar todas las abreviaturas de EncodedCommand también en main y evitar que -File/-f/-fi/-fil eludan el permiso de lectura. Scripts opacos y gestores del sistema no son recordables.
- Extender el IPC existente con una opción tipada de recordar; ausencia de ventana, payload inválido o cancelación nunca aprueban.
- Propagar AbortSignal y timeout del loop hasta el permiso pendiente; Stop o expiración cierran el modal y una decisión tardía no produce efectos ni guarda concesiones.
- group_by_extension usa el mismo esquema de carpetas y manifiestos existente; el valor omitido conserva el destino plano anterior.
- Resolver colisiones comprobando cada sufijo incremental y propagando errores de acceso; no depender de un timestamp que puede repetirse.
- No aumentar el límite de diez tandas (veinte con workspace). Tras la última tanda, deshabilitar herramientas para obtener un cierre basado en resultados. No ejecutar llamadas emitidas pese a esa restricción. Gemini debe procesar la respuesta que ya obtenía y descartaba.

## Risks / Trade-offs

La clasificación shell es conservadora: comandos desconocidos requieren aprobación inicial. La preferencia recordada no reemplaza la política main. Un proveedor puede ignorar el cierre sin herramientas: se conserva mensaje honesto y no se ejecutan más efectos. El fallo observado no tiene traza completa disponible.

## Rollback

Revertir este cambio; las huellas locales quedan inertes. No hay estado remoto. Los movimientos conservan undo_last_file_operation.
