# Implementación del panel de proyecto

Fecha: 2026-10-23. Estado: panel integrado en el checkout principal y verificado; sistema portable completo pendiente.

## Alcance entregado

- Apartado de proyecto en la misma interfaz, sin navegación por pestañas o nuevas ventanas.
- Sidebar real del Hub con su cabecera, perfil, transparencia, bordes, sombra, colapso y ajuste de ancho. Contenido contextual con Nuevo chat, globo del navegador, búsqueda, apartados y conversaciones recientes.
- Tipografía `--font-system-ui` también en títulos, iconografía SVG de la familia existente, Button/Card y radios amplios. Sin nueva dependencia de producto o sistema de diseño paralelo.
- Resumen y secciones conectadas a datos de la API de gestión; se preservan subida/descarga cancelables, creación de tareas, gestión de miembros y guardado de investigación del navegador con revisión inline.
- Apertura de conversaciones y navegador con contexto capturado, listas filtradas y guards de cargas tardías. Carpetas anteriores conservadas sin conversión ni movimientos.

## Base y preservación

Se trabajó en .worktrees/project-panel, rama codex/project-panel, desde e166d25
y una copia de los cambios existentes, sin copiar .env o claves. El commit de
retirada a7d705c no se aplicó a ciegas: se conservó el transporte, custodia y
transferencias que el usuario ya tenía en desarrollo. No se fusionaron ni
publicaron cambios ajenos. El traspaso final verificó hashes contra el estado inicial y copió 44 archivos de una lista explícita. No hubo conflictos ni sobrescrituras de cambios posteriores. Los cambios quedan sin commit en el checkout principal; el worktree conserva una copia recuperable.

## Verificación

- Línea base: npm run typecheck pasó antes de implementar.
- Pruebas dirigidas: 6 archivos, 28 casos pasados, incluida la regresión de entrada al aula corregida. Incluyen búsqueda/navegación, métricas ausentes/cero, URL insegura, cancelación de descarga al cambiar proyecto, contexto de chats y guards reales después de una espera.
- Typecheck y lint incremental pasaron durante el desarrollo. La compuerta inicial detectó el inventario derivado desactualizado y un warning de fast refresh en la fixture; se corrigieron sin ampliar baselines.
- Smoke Electron aislado pasó: navegación, una ventana, ausencia de tabs de proyecto, tema claro/oscuro y menú compacto. Usa datos de prueba, no credenciales ni preload del producto.
- Dos repeticiones de captura Playwright fallaron por timeout del compositor oculto después de cargar fuentes; no se cuentan como éxito. Se cambió la captura de la fixture a WebContents.capturePage con stayHidden/stayAwake, manteniendo las aserciones de navegación y ventana única; el smoke posterior pasó.
- Compilación Vite de renderer, main y preload: pasó, con avisos de tamaño de chunks/importaciones dinámicas existentes; no se cambió el presupuesto para ocultarlos. La compilación se repitió y pasó también en el checkout principal.
- Compuerta de PR en el worktree: pasó; 496 archivos de pruebas pasados, 2 omitidos; 5.470 casos pasados, 5 omitidos. La repetición en el checkout principal también pasó: mismos 496 archivos y 5.470 casos correctos, 2 archivos y 5 casos omitidos. Typecheck, arnés, documentación y lint incremental pasaron sin ampliar baselines.

Capturas de la fixture implementada: [claro](panel-implemented-light.png),
[oscuro](panel-implemented-dark.png), [compacto](panel-implemented-compact.png).
No acreditan OAuth real ni WebContentsView sobre sitios autenticados.

## Datos comprobados y límites

Se consultaron únicamente metadatos de columnas en la instancia SofLIA HUB
mediante el conector Supabase. Existen conversaciones con folder_id/org_id; no
se encontró project_chat_bindings en esa instancia. La lectura de compatibilidad
se probó con sus estados de ausencia/error y requiere una carpeta accesible,
además de autorización de proyecto. No se ejecutó DDL, mutación de negocio ni
lectura de claves. El changelog de Supabase y el contrato vigente de maybeSingle
se consultaron sin cambiar versión del cliente.

Las carpetas anteriores pueden crear/abrir chats con su persistencia existente.
Un proyecto de gestión sin vínculo no puede crear chats todavía; se muestra el
motivo y no se inventa asociación ni se manda el chat al espacio general. Este
adaptador no sustituye el contrato portable nuevo pendiente.

Hitos/ciclos y el detalle ampliado de equipos no están expuestos por el cliente
actual y muestran esa limitación. La analítica usa el corte actual y el total
informado por la API; no inventa series históricas. Los listados con has_more
se identifican como parciales, sin presentarlos como totales completos. La
gestión actual sólo añade miembros existentes por identificador; invitaciones
por correo y nuevos contratos de portabilidad siguen pendientes.

No se completaron las cuatro modalidades de almacenamiento, importación,
exportación o colaboración integral del plan. Esta entrega no se archiva como
sistema terminado.

## Revisión adversarial y reversión

Resultado: se corrigió la consulta de carpetas fuera de contexto de proyecto, se retiraron cargas de Supabase innecesarias al entrar al aula y se repitieron sus tres escenarios sin alterar sus expectativas. Los cambios de actor/organización retiran el panel y su navegador antes de volver a validar acceso. La pertenencia real de chats de gestión sigue limitada al vínculo existente, no se certifica por un UUID. No se archiva el plan completo.

Se revisan como invariantes: no filtrar conversación global al navegador del
proyecto; no aplicar cargas tardías a otra identidad; no considerar un error
como cero; no ejecutar scripts de evidencia; no perder cancelación de subida o
descarga; no conceder owner por un selector del cliente; no convertir carpetas
Lia existentes. Evidencia automatizada en los tests de ProjectWorkspace,
useProjectWorkspace, ProjectChatActions y UnifiedProjectHub.

Reversión: retirar únicamente los cambios de composición y componentes de esta
entrega, conservando datos y contratos nativos. No hay migración que revertir.
