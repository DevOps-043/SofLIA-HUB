# Revisión del plan de proyectos portables

Fecha: 2026-10-23. Alcance: artefactos de planificación; no implementación, despliegue ni cambios de base de datos.

## Evidencia de validación

- OpenSpec: `node node_modules/@fission-ai/openspec/bin/openspec.js validate add-portable-project-workspaces --strict --no-interactive`, resultado válido.
- Documentación: `npm run docs:check`, enlaces válidos, incluido este reporte; validación repetida tras ampliar el panel.
- Estado OpenSpec: propuesta, diseño, cuatro especificaciones y tareas presentes; planificación completa. Las tareas de implementación siguen pendientes.
- No se ejecutaron pruebas de aplicación porque no se modificó código operativo. Los escenarios normativos son criterios por implementar, no pruebas ya superadas.

## Hipótesis revisadas

| Hipótesis que se intentó refutar | Resultado del diseño |
|---|---|
| Un UUID o rol dentro de un ZIP concede acceso | Se exige autorización actual del servidor; copiar remapea IDs y no activa miembros |
| Un fallo de red duplica proyecto o borra una carpeta | Diario durable, recibos idempotentes y recuperación; sin compensación destructiva |
| Ser miembro de Soflia abre automáticamente un disco o carpeta cloud | Negado: publicación explícita o raíz compartida y permisos comprobados |
| Revocar Soflia impide toda lectura desde Drive | Hallazgo corregido: el proveedor conserva su propia ACL; no se promete control externo |
| Un manifiesto sincronizado puede contener tareas privadas por comodidad | Hallazgo corregido: manifiesto cotidiano mínimo; snapshots sólo en exportaciones revisadas |
| El cliente de escritorio y la API pueden escribir sin coordinación | Un responsable de sincronización por árbol y transición verificada |
| La API local demuestra que el despliegue y RLS están listos | Preflight autenticado pendiente; el reporte previo no acredita el estado actual |
| Una importación puede escribir fuera de su raíz o ejecutar contenido | Validación, staging limitado, cuotas, revisión al publicar y ninguna ejecución automática |
| La retirada anterior puede integrarse ignorando cambios actuales | Reconciliación explícita como primera tarea; preservación del trabajo ajeno |
| Abrir un proyecto puede seguir enviando un prompt al chat o usando tabs | Requisito nuevo: resumen en la superficie principal y navegación vertical sin pestañas/ventanas |
| Vincular un chat privado lo vuelve compartido | Referencia privada, publicación separada con audiencia revisada; títulos/contadores filtrados por actor |
| Asignar un equipo concede acceso masivo | Se separa la asociación de equipo de la política de membresía efectiva |
| Una cifra actual permite reconstruir tendencias históricas | Fórmulas comunes y eventos suficientes; Sin datos/Error/Offline separados de cero |
| Una página sin preview puede abrir ventanas como fallback | Limitación explícita en la misma superficie, sin apertura automática |

## Ampliación visual del panel

La solicitud posterior queda incorporada a propuesta, contexto, diseño D12, requisitos de almacenamiento/colaboración, plan y tareas. El bloque 10 de tareas es transversal a las fases 3, 5 y 9; debe completarse antes de liberar. No se creó código operativo ni una especificación duplicada.

Se generó [project-panel-v1.png](project-panel-v1.png) con la herramienta integrada de imágenes y se copió al repositorio. Revisión visual: una interfaz con menú vertical, sin tabs/ventanas ni compositor de chat; secciones requeridas visibles; datos de ejemplo identificados; 24/36 y 8/12 coherentes con 67 % redondeado, dos de cuatro hitos y seis colaboradores en dos equipos. No constituye prueba de funcionalidad, accesibilidad o métricas reales. Prompt reproducible en [el plan](../plan.md).

## Revisión del lateral flotante y chats del proyecto

Solicitud posterior: conservar el panel central aprobado, replicar el lateral flotante/redondeado del Hub, añadir el icono del navegador y mantener dentro del proyecto todos los chats creados en él. Se actualizaron propuesta, contexto, diseño D13, plan, tareas 10.13–10.17 y requisitos normativos en los dos documentos afectados. Las tareas siguen pendientes.

Se revisaron por código Sidebar, Header, TopActions, NavTools, BrowserWorkspaceLayout, ArtifactViewerPanel, ProductivityDashboard y MeetingOpsPanel, contrastados con el estándar y sistema visual/frontend canónicos. No se ejecutó ni se afirmó un smoke de las pantallas reales. El menú nuevo deberá componer sus primitives y preservar preferencias; no se ha modificado código del producto.

Se generó [project-panel-v2.png](project-panel-v2.png) como edición de la primera imagen con la herramienta integrada y se conservó el original. Se revisaron visualmente el margen exterior, las cuatro esquinas, el menú completo, Nuevo chat, búsqueda, globo Navegador y chats recientes. El contenido y cifras del panel central se mantienen; el espacio se ajusta a la isla lateral. Prompt registrado en [el plan](../plan.md).

Hipótesis refutadas en diseño: una asociación fallida no puede producir fallback a un chat global; una respuesta tardía no puede reasignar conversaciones al proyecto ahora visible; guardar pertenencia no concede acceso público; navegar no publica historial; z-index CSS no evita que una WebContentsView tape el lateral. Se añadieron estados recuperables, aislamiento de contexto y reserva de bounds nativos como criterios por implementar. No son pruebas de runtime superadas.

## Riesgo residual y condiciones de avance

Permisos IRIS, contrato desplegado, scopes/pickers, versiones, cuentas soportadas y límites reales requieren comprobación técnica. No hay evidencia nueva de SQL remoto ni de autorización entre actores en esta entrega. Los contratos portables son propuestos, no endpoints existentes.

Las cuatro modalidades de almacenamiento y colaboración sobre proyecto, tareas y archivos permanecen en alcance. Un piloto local no satisface por sí solo la entrega completa. Las carpetas Lia y los archivos existentes se preservan sin conversión automática.

Antes de habilitar producción se requieren los escenarios de dos actores/organizaciones/equipos, pruebas nativas de proveedores, restauración y fallos parciales descritos en [las tareas](../tasks.md). Este reporte no certifica esas pruebas futuras.
