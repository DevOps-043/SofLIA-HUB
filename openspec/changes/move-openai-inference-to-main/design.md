## Context

Ver propuesta/context-pack. Dos consumidores usan Responses: el ciclo de chat
en streaming y los workers de análisis en respuesta normal. La ejecución de
herramientas permanece en su dispatcher con revisión existente.

## Goals / Non-Goals

Retirar el SDK HTTP y la clave OpenAI de renderer/preload; conservar el contrato
utilizado por ambos consumidores. No sustituir este trabajo por un arreglo de
caché, ni declarar cerrada toda la custodia IA: Gemini, RPC/roles servidor y
credenciales incorporadas al bundle main siguen requiriendo migración propia.

## Decisions

- SDK oficial en main y puerto Responses pequeño en renderer, sin simular toda
  la clase SDK ni aceptar fetch/URLs/headers externos. Conservar modelos y
  configuración actuales; sólo crear respuestas, sin endpoints de administración.
- Cuatro canales open/start/pull/cancel. El scope se captura en main por ventana,
  marco/documento, identidad y sujeto Lia nativo. Navegación, logout y A/B/A
  invalidan el scope. Identificadores aleatorios nunca sustituyen la comprobación
  de emisor ni conceden identidad desde el payload.
- Clave sin caché global: consultar get_api_key para OpenAI con la sesión Lia
  nativa vigente; fallback de entorno sólo al faltar clave, no tras error de RPC.
  Verificar sujeto antes/después de esperas y observar cambios SDK sin await
  dentro del callback. No se inventa igualdad de IDs entre SOFIA y Lia.
- El handler Auth deja un recibo sólo después de aplicar Lia y revalidar la
  publicación. Mientras main cambió y Lia aún conserva al anterior sujeto, el
  selector OpenAI falla cerrado; A/B/A de main invalida el recibo. Un restablecimiento
  previo al bootstrap no lo fabrica: espera la publicación aceptada del renderer.
- Reserva síncrona de cuatro trabajos físicos globales. Máximo ocho registros
  retenidos, una lectura por trabajo y respuesta bajo demanda, con replay del
  último cursor. No crear una cola ilimitada ni leer el stream por adelantado.
- Presupuestos: 32 MiB por solicitud/evento, 64 MiB acumulados por stream,
  15 minutos por petición y 60 segundos ocioso entre lecturas. Mantener plaza
  hasta concluir I/O/cierre físico aunque el usuario deje de esperar.
- Separar cancelación local del trabajo que ya llegó al proveedor. Cerrar
  iterador al abandonar, revocar, exceder presupuesto o finalizar. Sanear errores
  conservando categoría/estado y retry-after acotado, sin claves/cuerpos/headers.
- El body admite los campos/formatos consumidos del proveedor y herramientas
  function/web_search/file_search. No abre computer, shell, MCP ni rutas remotas
  arbitrarias. Los argumentos/contenidos JSON siguen siendo datos no confiables;
  el servidor valida su semántica, sin convertirlos en autorización local.
- Vite usa defines públicos exactos y ningún envPrefix implícito. OpenAI queda
  excluido también del preload; las demás variables actuales conservan su
  comportamiento hasta su migración, sin tocar .env o secretos reales.

## Risks / Trade-offs

- RPC/credenciales de servidor accesibles por otra vía → no afirmar custodia
  integral: no se inspeccionan secretos ni se aplican cambios remotos en este lote.
- Secreto incorporado a main → no se considera oculto frente al dueño del
  instalador; un broker servidor con autorización/cuotas conserva trabajo pendiente.
- Proveedor que ignora cancelación → retener plaza y bloquear repetición; no
  fabricar una liberación física por vencer la espera pública.
- Backpressure o IPC interrumpido → cursor con replay único, límites y cierre
  explícito; se preservan texto parcial, errores públicos y reintentos existentes.

## Migration Plan

Primero demostrar regresiones y respaldar frente al lote 46. Implementar
contratos/servicio/handler/preload/wrapper y migrar ambos consumidores a la vez.
Probar SDK real con fetch ficticio y builds con claves centinela, sin proveedor
o GUI reales. Después compuerta/cobertura/build aislado y hashes del estado final.
Reversión sólo del delta con respaldos; preservar índice ajeno. Revisión
independiente pendiente; no archivar.

## Fuentes verificadas

- [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses).
- [SDK TypeScript oficial](https://developers.openai.com/api/reference/typescript).
- [RPC Supabase](https://supabase.com/docs/reference/javascript/rpc).
- [Identidad getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
- Changelog Supabase consultado al 27 de octubre: cambios TLS/PG revisados; no
  se cambia esquema, cliente o versión en esta unidad. Tipos/código del SDK
  instalado son evidencia del adaptador, sin resolver otros modelos por memoria.
