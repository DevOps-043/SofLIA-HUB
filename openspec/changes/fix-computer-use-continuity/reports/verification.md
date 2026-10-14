# Verificación de continuidad de Computer Use

Fecha: 2026-10-14. Base de aislamiento: `f0b18bc`, rama
`codex/fix-computer-use-continuity`.

## Diagnóstico confirmado
- El panel abría cualquier equipo nuevo, incluido `kind: computer` sin artefactos.
- El prompt base y la declaración de `use_computer` pedían preguntar si continuar
  ante todo resultado incompleto.
- La comprobación final de escritorio detenía el loop al primer cierre prematuro.
- El loop no procesaba el cierre devuelto tras la última acción del presupuesto.

## Evidencia ejecutada
- Lote dirigido de siete archivos: **97 pruebas correctas**. Incluye cliente y
  loop CU, ciclo de vida de escritorio, supervisión del navegador, panel,
  confirmaciones y prompt de visión.
- Tras añadir el caso de cambio de destino durante recuperación: lote final de
  cliente, loop y panel, **46 pruebas correctas**.
- Tras integrar en el workspace principal: lote de siete archivos, **98 pruebas
  correctas**, sobre el código final y junto con los cambios ajenos existentes.
- `npm run lint:changed`: nueve archivos TypeScript sin deuda nueva.
- `npm run docs:check`: enlaces válidos en 542 archivos Markdown.
- `npm run verify:pr`: **correcto**. Adaptadores, harness, cadena de suministro,
  documentación de sistema, enlaces, semilla de skills, validación de 67 cambios
  OpenSpec, typecheck, lint incremental y suite completa correctos. Suite:
  **430 archivos correctos y 2 omitidos; 4404 pruebas correctas y 5 omitidas**.
- El primer typecheck encontró un genérico faltante en la promesa del nuevo mock
  de cancelación; se corrigió el tipo y se relanzó la compuerta completa.
- La compuerta completa se ejecutó en el worktree aislado. Los nueve archivos
  TypeScript del workspace principal coinciden por SHA-256 con esa versión, y el
  lote dirigido de 98 pruebas se ejecutó también en el workspace principal.

## Revisión adversarial
Revisión local del diff, contratos y casos negativos con la skill
`ai-specs/skills/adversarial-review/SKILL.md`.

- Se intentó provocar reapertura del panel con actividad CU sin archivos, actividad
  completada y mezcla con entregables: la tarjeta vacía se omite y los archivos
  reales siguen accesibles.
- Se intentó recuperar con `canContinue` ausente, falso, string o junto a éxito:
  solo el booleano verdadero con meta incompleta habilita recuperación.
- Se intentó exceder presupuesto y repetir cierres prematuros: máximo dos
  recuperaciones, cada una consume un paso; no hay relanzamiento desde el chat.
- Se intentó ejecutar acciones tras cancelar, cambiar destino o exigir HITL:
  no se ejecutan; los errores de acción previos tampoco activan recuperación.
- La comprobación final utiliza una captura nueva y el último paso puede cerrar
  correctamente sin permitir una acción adicional.

## Límites y reversión
No se abrió Minecraft ni se descargaron actualizaciones durante QA. La decisión
visual de transición recuperable depende del modelo; se conserva la revisión
humana para acciones sensibles y el límite original. El verificador de escritorio
es quien habilita recuperación; otros backends conservan su verificación actual.
No se cambiaron IPC, permisos, persistencia, secretos ni dependencias.

Revertir únicamente los archivos de este cambio restaura el comportamiento previo.
El trabajo inicial de estudio y apagado del navegador se conserva por separado.
