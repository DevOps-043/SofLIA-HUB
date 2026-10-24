# Contexto del cambio

- Objetivo: reducir deuda de autorización IPC de Project Hub conservando integración y custodia de sesión.
- Actor: usuario SOFIA verificado, marco principal de la ventana main registrada, API v1.
- Evidencia: assertSender sólo compara id si existe ventana; falla abierto si no existe. No revisa frame/origen, exige aridad ni HITL. Los records aceptan payload libre y una navegación durante restore puede preceder una escritura con aprobación antigua.
- Alcance: caller cerrado con helper existente, schemas compartidos precisos derivados del contrato local del servidor, snapshot JSON acotado, confirmación nativa por mutación y contexto opcional explícito hasta HTTP/auth.
- No objetivos: agregar endpoints o canales, modificar permisos/RLS/revocación del servidor, corregir accesos IRIS directos o rediseñar el uploader renderer. No hay migración ni despliegue.
- Restricciones: conservar doce unidades anteriores y rama actual; sin concurrencia de agentes, secretos/.env/perfiles o efectos remotos. Baseline: cuatro casos handler; gate anterior 4964 aprobados y cinco omitidos.
- Contratos: 22 canales existentes; mantener nombres/payloads válidos, agregar sólo último argumento opcional de autorización interna a métodos del servicio. Wrapper y preload tipados con el mismo contrato compartido, sin exponer contexto ni tokens.
- Riesgo/HITL: todas las escrituras v1 por IPC requieren diálogo nativo contextual, cancelable, vigencia 120 s y exclusión mientras otro diálogo siga abierto. approved=true de reunión no constituye aprobación nativa. Usuario y destino no cambian después de aceptar. Operación ya enviada puede quedar incierta; no repetir automáticamente.
- Criterios: ausencia de ventana, sesión, origen o frame deniega antes de servicio; payload/aridad inválidos no abren diálogo; cancelar/expirar/navegar/A-B-A no escribe; la señal llega al fetch y bloquea envío tardío tras restore; respuesta anterior no vuelve al frame nuevo; sin listeners retenidos; cuatro capas y consumidores válidos conservados.
- Incertidumbres resueltas por lectura: schemas.ts del repositorio Project Hub contiene campos/límites v1 no descritos en OpenAPI; se deriva el contrato cliente sin editar ese repositorio. No constituye evidencia de despliegue. Roles efectivos y permisos siguen siendo autoridad del servidor.
