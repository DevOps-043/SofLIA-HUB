# Contexto del cambio

- Objetivo: reducir deuda de subida de archivos Project Hub sin exponer URLs/tokens temporales ni separar sus consumidores.
- Actor: usuario SOFIA vigente, ventana main registrada y proyecto autorizado por API v1.
- Evidencia: renderer usa PUT al signed_url remoto sin comprobar host/path/token/redirect, no cancela ni limita espera; recorta silenciosamente a diez y materializa todos los archivos al calcular hashes.
- Alcance: selección nativa en main, lectura acotada y validación local, aprobación del lote con destino comprobado, upload secuencial en main con token privado, cuotas/cancelación/avance parcial seguro, wrapper/UI integrados.
- No objetivos: cambiar endpoints/SQL/storage/RLS del servidor, borrar huérfanos remotamente, prometer transacción de lote, rediseñar descarga firmada ni desplegar.
- Restricciones: trece unidades previas preservadas, sin secretos/.env/perfiles ni cuentas reales. No agentes paralelos. Cambios en rama actual. Pruebas con temporales y HTTP loopback ficticios.
- Contratos: servidor local files/intents devuelve evidence_id/path/signed_url/token, storage project-files; complete valida MIME/tamaño/hash. SDK instalado construye object/upload/sign y token de query. Cada intención pide un solo archivo para vincular su única respuesta sin suponer binding por orden de un lote.
- Cuatro capas: retirar create-upload-intent/complete-upload del renderer y allowlist, conservar métodos main para el protocolo; nuevos upload-files/cancel-upload tipados reciben destino y UUID de operación, nunca rutas/bytes/URLs/tokens. El selector de archivos vive en main. UI permite cancelar y cancela al desmontar/cambiar proyecto.
- HITL: selección nativa y confirmación de lote con nombres/tipos/tamaños/hashes y proyecto comprobado; aprobar no habilita otro lote. Señal de caller/sesión/operación hasta lectura y red. Una operación activa por registro; picker pendiente conserva bloqueo hasta cerrar.
- Criterios: no truncar; validar todos antes de crear intención; cambios de bytes tras aprobar no se envían; token sólo al origen storage configurado y ruta exacta de cada evidence; no redirects/retry automático; no complete tras PUT fallido; no siguiente archivo tras fallo/cancelación; informar sólo contadores confirmados e incertidumbre, sin rutas/tokens/errores remotos.
- Incertidumbres: código local no demuestra despliegue. Origen permitido proviene sólo de VITE_IRIS_SUPABASE_URL pública de main, nunca de signed_url remoto. No hay limpieza remota ni concesión persistente/reanudación. Un efecto enviado puede terminar pese al aborto.
