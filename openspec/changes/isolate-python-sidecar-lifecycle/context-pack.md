# Contexto del cambio

- Objetivo: reducir deuda de fiabilidad/modularidad y acotar transporte NDJSON de los sidecars Python sin separar sus consumidores del sistema.
- Actor: voz local/dictado/Piper y transcripción Meeting Live; lectura de documentos/PII mediante PythonToolsService.
- Evidencia actual: ambos servicios mantienen proc/pending/buffer/listeners globales. Un exit antiguo limpia proc/peticiones actuales. ensure devuelve al ver proc aunque aún no haya ready; tools usa finally sin observar su promesa derivada. Los restart de voz no se cancelan al parar.
- Alcance: conexión por proceso compartida, startup single-flight, propiedad de respuestas/eventos/fallos/cierre y restart cancelable; límites NDJSON/peticiones/cola y cierre limpio.
- No objetivos: modificar modelos, Python distribuible/requirements, autorización IPC, permisos de micrófono, descargas/instalación de modelos, RLS, configuración de usuario, esquemas semánticos completos de cada evento ni cambiar el protocolo Python v4/v1.
- Restricciones: conservar fachadas públicas, main/preload/renderer y APIs consumidoras, español, sin nuevas dependencias, preservar quince unidades previas. Sin lectura de perfiles/.env ni audio/red reales.
- Contratos: NDJSON ready v4 (voz), v1 (tools), id/ok y payloads existentes; eventos y ToolsResult existentes; fallo explícito en lugar de contaminación entre generaciones.
- Riesgo/HITL: medio/alto por captura/procesos. Verificación usa procesos ficticios/stdio y rutas temporales; no activa captura ni escribe en servicios remotos.
- Criterios: exit/error/stdout viejos no afectan al proceso nuevo; todos esperan el mismo ready comprobado; timeout/cierre/error rechazan sólo sus peticiones y limpian recursos; stop invalida antes de esperar y cancela restart; buffers/cola/pending acotados; eventos/casos de negocio y firmas conservados; tests/gate/build verdes.
- Incertidumbres: python-runtime/python.exe no existe en este checkout; verificar transporte con procesos reales de prueba y localizar runtime de QA mediante inventario configurado, sin declarar audio/modelos/instalación como probados.
- Resuelto por inspección: el inventario de dependencias de la app ofrece Python 3.12.14 de QA. Se ejecutaron ambos programas Python reales y el transporte main con ese intérprete, sin instalar ni modificar el distribuible ni cargar audio/modelos.
