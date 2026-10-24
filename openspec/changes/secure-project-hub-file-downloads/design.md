## Context

Ver propuesta/context-pack. Main ya captura identidad invalidable y controla caller/HITL. La subida deja tokens/bytes en main y el visor local usa copia nueva sin sobrescritura. La API de evidencia devuelve metadata; la de descarga firma por 300 s sin entregar metadata de integridad adicional.

## Goals / Non-Goals

**Goals:** copiar sólo evidencia upload ready, bytes coincidentes y URL vinculada al storage/proyecto; no credenciales/rutas renderer; publicación íntegra exclusiva y cancelación comprobable.

**Non-Goals:** abrir/ejecutar archivos, sobrescribir destinos, modificar servidor/RLS, antivirus, certificar ZIP OOXML ni reanudar descargas tras crash.

## Decisions

- Capturar lease de sesión para todo el flujo. Obtener getEvidence y validar IDs, upload/ready, no archivado, MIME/extensión, tamaño de 1 byte a 20 MiB, hash SHA-256 y storage_path exacto workspace/project/evidence.ext. El nombre sugerido se sanea o sustituye por nombre seguro con evidence UUID; no se interpreta como ruta.
- Aprobar metadata/destino con nativeConfirmation compartida y después SaveDialog main selecciona copia nueva. No recibir ruta del renderer ni abrir shell. Verificar extensión de destino compatible con MIME. Política sin sobrescritura consistente con artifact-viewer: colisión exige elegir otro nombre, sin borrar ni reemplazar archivo existente.
- Solicitar getDownload después del selector. URL HTTPS salvo loopback configurado, origen público VITE_IRIS_SUPABASE_URL, object/sign/project-files/path exacto, un token ASCII y TTL de 1–300 s. No cookies/bearer, redirects ni retry del GET de bytes. El servidor sigue autorizando recursos; la verificación local no concede permisos.
- Leer respuesta por streaming con límite declarado y real; comparar longitud exacta, hash y firma/formato compartido con upload antes de escribir. Hasta 30 s para bytes y presupuesto 90 s después de elegir destino, sumando metadata final/red/publicación; espera humana independiente. No confiar en Content-Disposition para el nombre ni en Content-Type como autoridad sobre bytes.
- Publicación: staging propio exclusivo modo 0600 en directorio real elegido, fsync/cierre y hard link exclusivo al nombre final. Nunca escribir bytes parciales al destino ni reemplazar una colisión, aun si aparece después del selector. Revalidar caller y directorio antes de publicar. Limpiar sólo staging propio; no borrar final tras commit. Crash puede dejar .part propio, se documenta sin barrido implícito.
- Si publicación ocurre antes de cancelación/cambio de contexto, resultado conserva saved=true/bytes aunque success=false; no afirmar que cancelar borra una copia ya publicada. Fallos previos no devuelven nombres, rutas, URL, token ni error remoto crudo. Sin garantías frente a control completo del mismo usuario del SO.
- Si link no confirma resultado salvo colisión EEXIST comprobada, comunicar uncertain/recoveryRequired incluso si llega cancelación. saved sólo acredita publicación confirmada; false con incertidumbre no prueba ausencia de archivo. La UI pide revisar destino y no afirma rollback.
- Extraer formatos/tipos y registro de operaciones porque ahora tienen dos consumidores. Una operación de archivo por registro entre upload/download; cancelar compara tipo/id/actor/WebContents/frame. Picker pendiente conserva slot hasta cerrar. Dos canales download-file/cancel-download sustituyen get-download, neto un canal más; método getDownload main sigue interno.
- UI Guardar copia sólo para upload ready, hook de descarga con cancelación/id y descarte de respuesta obsoleta; vista de proyecto con key por destino para no reutilizar listas/acciones antiguas al cambiar props. No refactor general de lecturas/listados en esta unidad.

## Risks / Trade-offs

Sin sobrescritura y sin apertura automática son políticas deliberadas coherentes con el visor. El hard link puede fallar en un filesystem no compatible: se falla sin publicar parcial ni degradar a copia truncada. Publicación posterior a un cambio de directorio fuera de los controles del mismo usuario del SO no se certifica. Temporales pueden quedar tras crash o fallo de cleanup; no se borran archivos ajenos. Un signed URL ya emitido puede vivir hasta expirar, aunque no se entregue al renderer.

## Migration Plan

Baseline, reproducción de exposición URL y pruebas negativas; módulos de formato/registro compartidos, servicio/guardado seguro, cuatro capas y UI; pruebas de disco/HTTP/carreras y native smoke. Tipos/lint/build/gate. Reversión conjunta conserva upload/custodia y catorce unidades previas, pero downgrade reexpone la URL. Revisión independiente antes de archivar.
