# Evidencia de permisos y cierre del chat

Fecha: 2026-10-05. Rama: `codex/runtime-command-approvals`.

## Diagnóstico

La captura mostró confirmación de batch_move_files y agotamiento con última
herramienta list_directory_summary. La traza completa del turno no fue aportada.
El código confirmaba todos los movimientos por lote; el catálogo obligaba a
separar extensiones si quería mover y ordenar a la vez. Gemini descartaba la
respuesta que ya había pedido después de la última tanda y OpenAI no solicitaba
un cierre final. Se corrigen ambas rutas sin ampliar el número de tandas.

## Implementación y decisiones

- Siempre permitir guarda SHA-256 del comando exacto, herramienta y carpeta,
  dentro de preferencias del usuario, hasta 200 entradas. Nunca texto de shell.
- Cambios del entorno, sistema, borrado, comandos compuestos, scripts opacos y
  gestores del sistema no admiten recuerdo; main sigue bloqueando sus comandos
  prohibidos. Movimientos reversibles declarados no muestran el modal.
- El canal existente computer:confirm-action incorpora command y allowAlways;
  main liga command al detalle mostrado, valida payload, sesión y ventana emisora.
- Stop, timeout y desmontaje cancelan el permiso y previenen ejecución tardía.
- Privacidad y Gobernanza permite revocar las concesiones del usuario activo.
- group_by_extension mueve y clasifica por origen en un solo lote con filtros y
  manifiesto de undo. La resolución de colisiones comprueba sufijos y propaga EACCES.
- Ambos loops procesan un cierre sin herramientas y nunca ejecutan otra llamada
  después de la última tanda.

## Verificación ejecutada

- Typecheck y lint incremental: correctos, sin incidencias nuevas.
- OpenSpec específico y global: correctos, 34 cambios validados.
- Harness, supply chain, semilla de Skills y enlaces/documentación: correctos.
- Pruebas focalizadas de permisos, IPC/preload, modal, lotes/undo y cierre:
  80 casos en siete suites, todos correctos. Después de cerrar las variantes de
  flags citados, las dos suites de permisos/main pasaron 54 casos adicionales
  ejecutados (incluyen casos ya cubiertos; no se suman como pruebas únicas).
- verify:pr previo: 3603 pruebas correctas y una omitida; repetición intermedia:
  3611 correctas y una omitida. Resultado final de verify:pr: **3635 pruebas
  correctas, una omitida; 344 suites correctas y una omitida**. Pasaron todas las
  fases de la compuerta. Typecheck y lint final complementan la corrección de
  sincronización del test de proyectos sin cambiar código del producto.
- git diff --check: correcto.

La primera ejecución de verify:pr detectó que el inventario documental no incluía
los cuatro nuevos archivos de prueba. Se actualizó a las cifras derivadas por el
validador: 510 archivos inventariados, 356 main, 153 renderer y uno de scripts.
No se relajaron gates ni se añadieron dependencias.
Una repetición completa encontró la carrera preexistente de
`UnifiedProjectsSection.test.tsx`: esperaba el texto de vacío, que también está
presente antes de cargar workspaces, y clicaba demasiado pronto. La suite aislada
pasó (dos casos); se corrigió la sincronización esperando las dos llamadas reales
de listProjects antes de interactuar. Se conservan todas sus aserciones.

## Revisión adversarial independiente

El agente review_command_approvals revisó sólo lectura tras las pruebas normales.
Encontró y se corrigieron:

- Checkbox nativo ausente en background con carpeta: se clasificaba la descripción
  multilínea. Ahora command viaja separado y vinculado al texto mostrado.
- EncodedCommand abreviado (-e/-en/-ec y demás prefijos) podía ser recordado.
  Se bloquea también en main mediante detector compartido, con pruebas de todos
  los prefijos, guiones Unicode y banderas citadas/fragmentadas. PowerShell/pwsh
  se excluyen conservadoramente de las concesiones recordables.
- -File/-f podía parecer lectura con un script llamado Get-Process .ps1. Se
  excluyen scripts antes de desenvolver el comando, con pruebas de regresión.

Cancelación, usuario/carpeta, revocación, límite de ejecución y colisiones
secuenciales no mostraron otros hallazgos materiales.
La segunda revisión independiente confirmó P1/P2 cerrados, sin bloqueos
materiales adicionales; no repitió la suite completa.

## Límites y riesgo residual

Las pruebas del proveedor y diálogo usan dobles; no se ejecutó una organización
sobre archivos reales del usuario ni una petición real al modelo. El fallo exacto
de la captura no se atribuye exclusivamente al límite sin su traza.
La carrera preexistente entre dos lotes simultáneos que elijan el mismo destino
no queda convertida en una reserva atómica por este cambio. La clasificación
conservadora exige aprobación inicial para comandos desconocidos y no convierte
una concesión en permiso global de shell. No se modifican permisos WhatsApp,
nodos remotos ni herramientas dinámicas.

Rollback: revertir el cambio. Las huellas quedan inertes; no hay migraciones ni
estado remoto. Los lotes guardan operationId y se deshacen con la herramienta
existente. Para cargar cambios de main/preload debe reiniciarse la app de desarrollo.
