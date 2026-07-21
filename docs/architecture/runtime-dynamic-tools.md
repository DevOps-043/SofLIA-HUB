# Herramientas dinámicas runtime

## Alcance

`MCPManager` descubre `.json`, `.js` y `.ts` únicamente en los directorios
configurados por `DynamicToolService`. No examina `ai-specs/`, adaptadores de IDE
ni skills de desarrollo. Una instrucción Markdown nunca concede permisos al
producto.

El primer consumidor gobernado es `whatsapp-agent`. Cada ejecución atraviesa:

1. descubrimiento y validación del contrato;
2. guard de canal y confirmación humana cuando la política exige HITL;
3. comprobación central de agente, grupo y aprobación;
4. validación Zod estricta de entrada;
5. handler acotado por timeout y `AbortSignal`;
6. validación Zod estricta de salida;
7. evento de auditoría minimizado.

## Contrato ejecutable

Todo módulo con `handler` debe exportar este contrato. Los objetos de entrada y
salida, incluidos objetos anidados tipados, declaran
`additionalProperties: false`. La entrada no admite nodos opacos. En la salida,
un nodo `{}` es opaco de forma explícita y se usa solo cuando una API externa
devuelve una estructura que SofLIA no controla.

```js
export default {
  name: 'inventory_get_item',
  description: 'Consulta un artículo autorizado del inventario.',
  inputSchema: {
    type: 'object',
    properties: { item_id: { type: 'string', minLength: 1 } },
    required: ['item_id'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: { success: { type: 'boolean' }, item: {} },
    required: ['success', 'item'],
    additionalProperties: false,
  },
  runtime: {
    owner: 'inventory-platform',
    risk: 'read',
    allowedAgents: ['whatsapp-agent'],
    hitl: 'never',
    allowInGroups: false,
    timeoutMs: 10000,
    audit: true,
  },
  async handler(args, context) {
    const response = await fetch(`https://inventory.invalid/items/${encodeURIComponent(args.item_id)}`, {
      signal: context.signal,
    });
    return { success: response.ok, item: await response.json() };
  },
};
```

Agentes permitidos: `whatsapp-agent`, `desktop-agent` y `meeting-agent`. Los
riesgos `write` y `critical` exigen `hitl: required` y no pueden habilitarse en
grupos. El timeout admitido está entre 100 y 60 000 ms. `audit` debe ser `true`.

## Auditoría

El evento `runtime_tool_execution` contiene solamente `traceId`, nombre,
propietario, riesgo, agente, `actorRef` seudónimo, resultado, duración y código de
error. Nunca contiene argumentos, resultado del handler, número de teléfono,
token, `jid` ni ruta local del plugin. El inventario y el doctor tampoco devuelven
rutas absolutas; instalación y desinstalación solo devuelven nombres de archivo.

Una aprobación queda ligada a la huella SHA-256 estable del nombre, descripción,
schemas y política. Si el watcher recarga un contrato entre el preflight y la
ejecución, el ejecutor devuelve `contract_changed` y exige iniciar una nueva
confirmación.

## Migración y diagnóstico

Los plugins ejecutables legacy sin `outputSchema` o `runtime` se rechazan al
cargar. Para migrarlos:

1. cerrar el esquema de entrada;
2. declarar y cerrar el esquema de salida;
3. asignar propietario y riesgo reales;
4. limitar `allowedAgents` al consumidor necesario;
5. exigir HITL para escritura/crítico y deshabilitar grupos;
6. propagar `context.signal` a I/O cancelable;
7. ejecutar las pruebas de contrato y `doctor_dynamic_toolsets`.

Los toolsets administrados que no carguen todas sus herramientas aparecen como
`degraded`. Reinstalar un builtin regenera sus archivos con el contrato vigente.

## Rollback

Revertir el código y reinstalar la versión anterior del toolset restaura el
loader previo. No existen tablas ni estado remoto que migrar. No se recomienda
relajar el parser para recuperar un plugin: debe corregirse su contrato.
