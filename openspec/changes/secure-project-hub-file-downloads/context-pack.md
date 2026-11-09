# Contexto del cambio

- Objetivo: retirar URL firmada de descarga del renderer y completar guardar copia validada en main sin alterar servidor ni desacoplar UI.
- Actor: sesión SOFIA vigente, marco principal main registrado y evidencia upload ready del proyecto autorizado.
- Evidencia: getDownload devuelve signed_url sin validar destino/bytes/lifecycle; no hay consumidor UI de descarga de uploads. Visor local ya exige copia nueva sin sobrescritura.
- Alcance: metadata/URL/bytes validados, selector/HITL nativos, publicación local completa sin sobrescritura, cancelación y resultado seguro, UI y cuatro capas migradas.
- No objetivos: ejecutar/abrir automáticamente archivos, modificar backend/RLS, cleanup de huérfanos remotos, antivirus o parser OOXML completo, reanudar tras cierre abrupto.
- Restricciones: preservar catorce unidades anteriores, rama actual sin agentes paralelos; no secretos/.env/cuentas reales ni efectos remotos. Sólo temporales ficticios y loopback en pruebas.
- Contratos: getEvidence local devuelve registro con storage_path/mime_type/file_size_bytes/content_hash/metadata.upload_state; download devuelve signed_url y expires_in=300. Origen permitido VITE_IRIS_SUPABASE_URL pública de main. El SDK usa object/sign/project-files y token de query.
- Cuatro capas: sustituir get-download por download-file y cancel-download con IDs de destino/operación; conservar getDownload main como protocolo interno. UI Guardar copia sólo para uploads ready. Nunca rutas/URL/bytes/tokens renderer.
- HITL: revisión nativa de archivo/hash/tamaño/destino y SaveDialog elige ruta. Copia nueva mediante publicación exclusiva; colisiones no se sobrescriben. Sesión/caller/proyecto/ID invalidan el flujo. No shell ni apertura automática.
- Criterios: no escritura con metadata/URL/tamaño/hash/firma incorrectos; no seguir redirect; cancelar o A/B/A impide publicación posterior; carrera de destino no reemplaza archivo existente; fallo parcial no publica truncado y limpia staging propio; cancelación tardía tras commit informa saved real.
- Incertidumbres: código local no acredita despliegue. No se promete antivirus, ausencia física de temporales tras crash ni defensa frente a control total del mismo usuario del SO. Se mantienen límites explícitos.
