## Context

Ver proposal.md. Existe trustedAppCaller/nativeConfirmation con invalidación por sesión, navegación y destrucción, vigencia de 120 s y bloqueo de diálogo pendiente. La custodia de Project Hub ya verifica identidad SOFIA y descarta respuestas antiguas, pero no conoce el caller Electron. La ventana main es el único consumidor registrado; no se amplían superficies a la orbe.

## Goals / Non-Goals

**Goals:** contrato de cuatro capas coherente; caller fail-closed; autorización humana por mutación; snapshot validado ligado a caller/identidad hasta el envío y retorno.

**Non-Goals:** cambiar permisos de backend o identidad, agregar canales/endpoints, certificar revocación JWT, corregir PUT firmado del uploader o consumidores IRIS directos, rediseñar UI de revisión ni afirmar atomicidad remota.

## Decisions

- Reusar trustedAppCaller/nativeConfirmation para main registrada, objeto WebContents y mainFrame exactos, documento esperado y sesión vigente. Ausencia de proveedor/ventana deniega. No se usa comparación de id como autoridad. Registrar y liberar contexto dentro de try/finally.
- src/shared/project-hub.ts declara schemas y tipos de entrada, derivados de apps/web/src/lib/api-v1/schemas.ts del repositorio Project Hub inspeccionado localmente. Strict en objetos de dominio/envelopes; metadata permanece JSON explícito. Aridad exacta por canal. Antes de Zod, validar snapshot JSON con cuotas de bytes/profundidad/nodos y sin ciclos/prototipos/accesores; copiarlo para evitar TOCTOU. No ejecutar stringify sobre entrada ilimitada.
- Mantener 22 canales y firmas externas. Tipar argumentos preload/wrapper con el mismo contrato; main sigue siendo el límite obligatorio de seguridad. Método público del servicio conserva argumento de negocio y agrega autorización opcional al final. Los consumidores internos existentes mantienen la custodia de sesión, con sus propias autorizaciones de dominio; contexto nunca viene del renderer.
- La autorización interna incluye userId capturado, assertCurrent y señal. Se compone con el lease de identidad del controlador. Revalidar antes/después de cada espera, enviar con señal compuesta y descartar respuestas antiguas. La renovación single-flight sigue siendo del propietario, independiente de una ventana; un caller cancelado no envía negocio tras esperarla. Retry-auth sí queda ligado a su caller.
- Cada mutación IPC comprueba sesión/workspace y, cuando existe, nombre/IDs del proyecto mediante lecturas del servicio antes de confirmar. No acepta etiquetas de destino desde el payload; workspace nuevo requiere canje para actualizar su lista. Después pide confirmación nativa antes de mutar. Se muestra usuario, workspace/proyecto/objetivo, operación y valores/cantidades de datos compartidos. Texto grande se resume por tipo y longitud, sin omitir que se comparte contenido; nunca se presenta como vista íntegra. Snapshot validado evita modificar el payload después de aceptar. approved=true recibido no reemplaza HITL.
- Cancelar retira la espera del caller aunque la custodia siga pendiente; no aborta renovación compartida del dueño. El helper común también rechaza frames separados; se repiten regresiones calendario/Gmail.
- Si el caller se pierde después de invocar una mutación se devuelve error fijo con uncertain/recoveryRequired; no se publica cuerpo/IDs anteriores ni se reintenta. No se confunde cancelación local con rollback remoto. La respuesta normal conserva sobre del servicio y sus errores seguros.

## Risks / Trade-offs

- Más confirmaciones en operaciones que escriben; upload intent y complete son mutaciones distintas sin concesión persistente entre IPC. No se inventa una aprobación transferible.
- El servidor local puede diferir del desplegado: registrar fuente/huella y probar consumidores reales, sin afirmar compatibilidad de despliegue no observado.
- Cuotas JSON son locales, no benchmark ni SLO. La interfaz sigue usando URLs firmadas para bytes; sus permisos/destinos requieren otro incremento.
- Confirmación humana no concede roles del servidor ni sustituye RLS. Errores posteriores al envío implican resultado incierto.

## Migration Plan

Reproducir fallos con handlers previos; aplicar contrato/caller, contexto hasta transporte y tipos; verificar negativos, carreras, expiración, cancelación y cuatro capas. Gate completo y build aislado; documentar riesgos. Reversión conjunta de handler/contrato/contexto/tipos, conservando custodia y doce unidades previas; volver al handler anterior reabre fallos y no es mitigación. Revisión independiente antes de archivar.
