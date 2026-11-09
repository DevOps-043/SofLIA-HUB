# Contexto

- Objetivo: reducir deuda de autorización, integridad, tipado y errores en nueve canales Gmail restantes: tres lecturas y seis mutaciones de mensajes/etiquetas.
- Evidencia: gmail-handlers usa handleIPC sin validar caller en esas rutas; label-cleanup retorna success:true con errores, y batch repite la primera página aunque las opciones no retiren origen. Los errores pierden avances y filtran mensajes crudos del proveedor.
- Actor: usuario Hub autenticado con conexión Google propia; runtime existente conserva sus permisos/HITL previos.
- Alcance: contratos compartidos, contexto de cuenta reutilizado, validación/confirmación en main, preparación de lotes antes de mutar, conteos parciales, errores seguros y pruebas de cuatro capas.
- No objetivos: nuevos canales, SQL, scopes/permisos, correos reales, nueva UI, diario general de recuperación tras crash ni una transacción remota. Los planes conservan su diario propio.
- Restricciones: conservar API posicional, separación main/preload/renderer, ramas/cambios anteriores y catálogo de herramientas. No inspeccionar .env ni perfiles reales.
- Criterios: rechazar actor/frame/args ajenos; aprobar alcance antes del primer efecto; detener al cambiar sesión; un cliente capturado; no retry; snapshot sin duplicar mensajes; no eliminar etiqueta con mensajes remanentes; conservar efectos confirmados ante fallos y marcar incertidumbre sin éxito falso.
- Riesgos: alto por mutaciones masivas. Gmail/disco no son transaccionales. La preparación tiene cuotas y puede ser rechazada antes de mutar; cambios concurrentes externos dejan una ventana entre comprobación y escritura. Sin token de idempotencia/crash recovery para estas operaciones: revisar Gmail antes de repetir un fallo.
