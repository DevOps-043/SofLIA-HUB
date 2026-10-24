## Context

Ver propuesta/context-pack. La API local genera intención individual, URL firmada Supabase project-files y validación final; no ofrece abort/cleanup de lote. Main ya dispone de sesión invalidable, caller y confirmación nativa. El renderer es el único consumidor actual de los canales de intención/complete.

## Goals / Non-Goals

**Goals:** bytes y token temporal en main, destino acotado, selección aprobada estable, cancelación y resultados parciales verificables, sin cambiar API remota.

**Non-Goals:** limpieza remota, reanudación persistente, transacción de lote, antivirus, permisos/RLS/revocación backend o rediseño de descargas.

## Decisions

- Selección nativa y lote explícito de 1–10 archivos, hasta 20 MiB cada uno. No recibir rutas/bytes por IPC ni recortar. Abrir sólo archivos regulares sin symlink final, comparar identidad lstat/fstat, retener handles hasta cerrar. Inspeccionar hash con bloques acotados y guardar declaración; después de aprobar releer como máximo un archivo completo y comparar tamaño/hash antes de crear intención. No hacer Promise.all de bytes de todos los archivos.
- Tipos permitidos y firmas derivados de lib/api-v1/files.ts: imágenes, PDF, texto/CSV y OOXML. Extensión elige MIME; no confiar en MIME del renderer. Validar UTF-8/texto sin NUL localmente; firma ZIP no acredita estructura OOXML ni ausencia de malware, el servidor conserva validación final.
- Lote ligado a caller/operación UUID, sesión y presupuesto de 180 s desde aprobación; PUT hasta 30 s, metadatos conservan timeout 15 s. Una operación activa por registro, cancelación sólo del actor/frame/id exactos. Picker pendiente retiene exclusión hasta cerrar; cancelar no promete cerrar el diálogo de archivos nativo.
- Servicio uploadFiles main requiere autorización explícita y callback de aprobación, sin depender de BrowserWindow. Handler resuelve destino, muestra selector y confirma todos los nombres/MIME/tamaños/hashes con cancelar por defecto; servicio captura lease durante toda preparación/red. Sesión/caller inválidos no repiten ni siguen al próximo archivo.
- Por cada archivo: una intención con una declaración, validar respuesta única, evidence UUID nuevo, path exacto workspace/project/evidence.ext, signed URL con origen público configurado VITE_IRIS_SUPABASE_URL, ruta exacta y query token igual al campo token. HTTPS salvo loopback explícito configurado. No derivar host de datos remotos ni aceptar URL/query extra/encoded path/redirect. PUT lleva sólo MIME/cacheControl/token de query, sin bearer de sesión ni cookies; no se requiere reenviar el token en Authorization según protocolo firmado inspeccionado.
- Validar configuración antes de leer bytes o crear efectos; no leer archivos .env desde este módulo. URL pública literal Vite sustituida en main, sin importar cliente IRIS que carga secretos. No agregar SDK ni dependencias.
- No retry de intent/PUT/complete; complete sólo tras PUT exitoso y contador confirmado sólo si devuelve misma evidencia/workspace/proyecto con upload_state=ready. En fallo/cancelación conservar requested/prepared/stored/uploaded confirmados y recoveryRequired, con incertidumbre si se inició un efecto sin respuesta verificable. No nombres/rutas/IDs/tokens ni errores crudos en resultado de fallo. Sin borrado remoto automático de huérfanos. La confirmación comparte exclusión con mutaciones de dominio.
- Retirar dos canales de primitivas renderer y añadir upload-files/cancel-upload; métodos main v1 siguen internos. UI deja de recibir File y cancela al desmontar/cambiar destino mediante UUID, sin reintento implícito ni cambios de proyecto tardíos.

## Risks / Trade-offs

Una selección seguida de confirmación añade pasos pero permite revisar los bytes/destino elegidos en main. Un handle abierto no impide que otro proceso escriba; comparación de hash antes de intención detecta cambios y el PUT usa ese buffer verificado. Un efecto remoto ya enviado puede completarse pese a aborto; se declara recuperación manual. Sin cuenta real no se acredita bucket/API desplegados. Descargas firmadas conservan su revisión propia pendiente.

## Migration Plan

Reproducir exposición de primitivas y contrato previo; implementar módulos de archivo/destino/orquestación, migrar cuatro capas/UI y pruebas dirigidas, HTTP real local y smoke Electron. Build aislado/gate y documentación. Revertir unidad completa conserva trece unidades anteriores; downgrade vuelve a exponer el uploader anterior. Revisión independiente antes de archivar.

El primer gate encontró una expectativa temporal no controlada en
browser-sqlite-recovery.test.ts: esperaba la primera generación del respaldo
sin fijar que su edad estuviera entre 0 y 30 s. Se reprodujo el mismo resultado
de dos registros con reloj anterior a mtime. La prueba fija su reloj lógico
dentro de la ventana de esa generación; no cambia backup/recovery de producción
ni la expectativa, y se conserva aparte el caso de rotación posterior.
