# Conexiones y streaming con recursos acotados

## Why

WhatsApp importa su SDK al construir el servicio, puede preparar sockets duplicados y conserva reintentos sin cancelar. Los listeners asíncronos pueden rechazar sin consumidor. El renderer publica cada fragmento del modelo y el bootstrap no contiene fallos ni respuestas tardías de ajustes.

## What Changes

- Diferir SDK y listeners WhatsApp hasta conectar; compartir intento en curso y revocarlo al desconectar o cambiar sesión.
- Un reintento por servicio, cancelable y con manejo explícito de errores; aislar también fallos de cada mensaje o llamada entrante para continuar el lote válido.
- Agrupar publicaciones de texto y actividad del avatar durante streaming, sin recortar respuesta, fuentes, imágenes o herramientas.
- Contener errores y resultados tardíos de inicialización del renderer.

## Capabilities

### New Capabilities
- `connection-stream-lifecycle`: lifecycle verificable de conexiones, reintentos y publicaciones incrementales.

### Modified Capabilities

Sin cambios de API pública ni permisos.

## Impact

Servicio y listeners WhatsApp, procesamiento de chat e inicialización React. Conserva autoconexión, QR, envíos, voz, documentos y herramientas. No se ejecutan conexiones reales ni envíos en QA.
