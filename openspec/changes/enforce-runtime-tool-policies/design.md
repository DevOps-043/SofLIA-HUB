## Context

`MCPManager` carga módulos arbitrarios desde directorios configurados y conserva
un `Map<string, ToolSchema>`. El loader solo comprueba nombre, descripción y un
esquema de entrada superficial; `executeRegisteredTool` invoca el handler sin
contexto, validación, timeout ni auditoría. WhatsApp sí tiene un guard general de
permisos y confirmación, pero sus listas son estáticas y no conocen herramientas
instaladas en runtime.

El primer consumidor gobernado será WhatsApp y el primer toolset migrado será
Home Assistant. Los agentes de desarrollo y sus skills permanecen fuera de este
registro ejecutable.

## Goals / Non-Goals

**Goals:**

- Convertir cada herramienta dinámica ejecutable en un contrato validado y
  denegado por defecto.
- Validar entrada y salida con Zod a partir de un subconjunto seguro de JSON
  Schema que Gemini también pueda declarar.
- Hacer que permisos, grupos, HITL, timeout y auditoría se apliquen en el punto
  central de ejecución.
- Reutilizar el diálogo HITL real de WhatsApp, preservando una segunda barrera en
  el ejecutor central.
- Entregar migración y diagnóstico legibles para toolsets administrados.

**Non-Goals:**

- Cambiar la exposición IPC o el modelo de autorización de herramientas
  estáticas.
- Permitir que argumentos generados por el modelo acrediten una aprobación.
- Persistir argumentos, resultados o secretos en el evento de auditoría.
- Ejecutar skills del arnés de desarrollo dentro del producto.

## Decisions

### Contrato runtime obligatorio dentro de `ToolSchema`

Una herramienta con handler declarará `outputSchema` y `runtime` con propietario,
riesgo (`read`, `write`, `critical`), agentes permitidos, regla HITL, acceso desde
grupos, timeout y auditoría. El loader validará el objeto completo con Zod y
rechazará ejecutables legacy.

Alternativa descartada: inferir riesgo por nombre o descripción. Esa heurística
es frágil, no auditable y hace que una nueva herramienta nazca permitida.

### Esquemas JSON cerrados convertidos a Zod

Entrada y salida usarán JSON Schema porque el mismo contrato alimenta las
declaraciones de Gemini. Un compilador interno construirá esquemas Zod estrictos
y soportará objetos, arrays, strings, números, enteros, booleanos, enums y nodos
opacos explícitos. Las raíces de entrada y salida serán objetos con
`additionalProperties: false`.

Alternativa descartada: exportar instancias Zod desde cada plugin. Eso dificulta
plugins JSON/JavaScript, acopla versiones entre proceso host y archivos
instalados y no sirve directamente como declaración Gemini.

### Autorización central con contexto no controlado por el modelo

`executeRegisteredTool` recibirá `RuntimeToolExecutionContext`: agente, canal,
grupo, aprobación humana, `traceId` y señal de cancelación creada por el host.
Los argumentos del modelo nunca contienen estos campos. El ejecutor verificará
agente, grupo y HITL antes de invocar el handler.

WhatsApp consultará la política para pedir confirmación mediante su mecanismo
existente y pasará el resultado al contexto. `skipConfirmations` no acreditará
aprobación para herramientas dinámicas que exijan HITL.

El preflight también obtiene una huella SHA-256 estable de nombre, descripción,
schemas y política. El ejecutor la recalcula justo antes de aplicar permisos; una
recarga entre confirmación y ejecución produce `contract_changed` y obliga a
repetir el flujo HITL.

Alternativa descartada: añadir cada nombre dinámico a `CONFIRM_TOOLS_WA`; esa
lista no puede anticipar herramientas instaladas después de arrancar.

### Timeout cooperativo y resultado acotado

El host creará un `AbortController`, pasará su señal al handler y competirá su
promesa contra el timeout declarado, limitado por el contrato. Al vencer,
abortará y devolverá un error tipado. Un plugin puede ignorar la señal, pero no
podrá retener la respuesta del agente indefinidamente.

### Auditoría estructurada y minimizada

Cada intento emitirá un evento con nombre, propietario, agente, riesgo,
`traceId`, resultado, duración y código de error. No incluirá entrada, salida,
sender, token ni rutas fuente. `MCPManager` expondrá el evento y registrará una
línea estructurada en el log del proceso principal.

## Risks / Trade-offs

- [Toolsets legacy dejan de cargar] → Denegación segura, error de loader y
  diagnóstico degradado; documentar el contrato y migrar el builtin incluido.
- [El subconjunto JSON Schema no cubre contratos complejos] → Rechazar nodos no
  soportados con un mensaje explícito, sin relajar validación silenciosamente.
- [Un handler ignora `AbortSignal`] → El llamador termina al timeout; los toolsets
  incluidos propagan la señal a `fetch` y la guía exige cooperación.
- [Confirmación duplicada o falsificada] → Solo el host construye el contexto; la
  política se consulta antes del diálogo y se vuelve a validar justo antes del
  handler.
- [Recarga TOCTOU conserva el nombre pero cambia permisos] → Ligar contexto y
  aprobación a la huella completa del contrato y denegar cualquier diferencia.
- [Logs con datos sensibles] → El evento tiene allowlist fija de metadatos y las
  pruebas comprueban que no serializa argumentos/resultados.

## Migration Plan

1. Añadir tipos, parser Zod, validación y errores sin cambiar aún consumidores.
2. Cambiar el servicio y dispatcher para proporcionar contexto gobernado.
3. Migrar los tres archivos generados de Home Assistant.
4. Actualizar tests, inventario y documentación; ejecutar OpenSpec, tipos,
   pruebas y build.
5. Tras desplegar, reinstalar toolsets administrados para regenerar sus archivos.
   Los toolsets externos deberán adoptar el contrato antes de volver a cargarse.

Rollback: revertir el cambio de código y reinstalar la versión anterior de cada
toolset. No hay migración de base de datos ni estado remoto que deshacer.

## Open Questions

Ninguna para este incremento. La persistencia durable de auditoría y la migración
de herramientas estáticas quedan para cambios OpenSpec posteriores.
