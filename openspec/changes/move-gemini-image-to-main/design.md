## Context

La aplicación de escritorio expone la clave en renderer para generar imágenes.
El proyecto ya vincula la sesión nativa Lia con el publicador main y obtiene
credenciales para OpenAI sin entregarlas por IPC.

## Decisions

Reutilizar la autoridad nativa existente con proveedor Google, manteniendo los
identificadores de SOFIA y Lia separados. Una operación admite solo un prompt
acotado y usa el modelo fijo del producto. Una reserva física se conserva hasta
que termine el proveedor incluso si se aborta; la respuesta se revoca al cambiar
sesión/ventana y tiene deadline. La imagen y texto de salida tienen límites y
se valida MIME/base64. Electron falla cerrado sin bridge; la ruta web autónoma
mantiene el SDK anterior. No se simula cancelación remota ni se reintenta.

## Risks

La clave Gemini sigue siendo pública en otros flujos del renderer, y el código
main puede incorporar la clave de entorno. La prueba sin proveedor real no
certifica comportamiento de cuenta, coste ni cancelación remota. Revisión
independiente pendiente; no modifica políticas RLS del servidor.
