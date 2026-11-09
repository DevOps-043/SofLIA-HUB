# Contexto del cambio

- Objetivo: cerrar la omisión de contratos Python en la compuerta de PR y preparar ejecución reproducible de formatos por plataforma.
- Usuario o actor: desarrolladores y CI; no agentes runtime del producto.
- Alcance: comando Node que exige Python 3.12.x y ejecuta runner stdlib sin dependencias; incorporarlo a verify:pr, configurar Python 3.12.11 en CI y job verify de release; workflow separado de formatos con los dos locks exactos en Windows x64/macOS ARM/Linux x64/ARM.
- No objetivos: modificar API/IPC, parsers o pins, certificar audio/modelos/instalador, ejecutar CI remoto, publicar, resolver o simular el candidato Intel pendiente.
- Restricciones: preservar veinte unidades previas y worktrees ajenos, reutilizar rama sin concurrencia; intérprete explícito QA sólo en entorno del comando, sin .env/configuraciones locales; ningún secreto ni SQL. No omitir pruebas si falta Python.
- Contratos afectados: nuevo prerrequisito de verify:pr y comando de pruebas, sin permisos nuevos del producto. La prueba de formatos sigue separada del gate ligero porque requiere instalar wheels.
- Riesgo y HITL: CI read-only y sin despliegue; no dispatch/push. Python ausente/incompatible debe fallar con ayuda accionable. Probar propagación de código/timeout y aislamiento frente a PYTHONPATH/user-site.
- Criterios verificables: versión incompatible/ausente y fallo del runner nunca dan verde; stdlib ejecutada realmente con Python de QA; gate contiene etapa Python no opcional; formatos instala hashes/sólo wheels y valida versiones; ambos jobs verify preparan Python; YAML/contratos probados, gate y build con fuentes estables.
- Incertidumbres: QA 3.12.14 frente a CI fijado 3.12.11, workflows no ejecutados remotamente, otros SO sin ejecución local; macOS Intel sigue abierto en unidad anterior. Fuentes primarias de labels: documentación GitHub y disponibilidad ARM en repos privados del 2026-01-29.
