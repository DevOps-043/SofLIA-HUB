## Context

Ver propuesta y context-pack. El runner Python existente tiene 33 contratos
stdlib y 15 casos opcionales de formatos que exigen locks exactos; no se invoca
desde el gate Node. CI/release verify sólo preparan Node 24. macOS Intel conserva
su candidato separado pendiente y no se modifica su política.

## Goals / Non-Goals

**Goals:** fallo visible y obligatorio ante contratos Python rotos; ejecución
de formatos reproducible configurada para cuatro targets, sin duplicar runner.

**Non-Goals:** cambiar comportamiento del producto o añadir pytest/dependencias runtime;
no declarar ejecución remota por inspeccionar YAML.

## Decisions

- Comando Node pequeño y standalone, sin shell ni descargas. Python se elige
por SOFLIA_TEST_PYTHON absoluto si está configurado; de otro modo python en
Windows y python3 en otros SO. Un override inválido no cae silenciosamente a
otro intérprete. Probe JSON acotado exige 3.12.x; ejecutar con -I -S -B para
contratos puros, sin -S para --formats. No usar runtime instalado ni descargarlo
automáticamente: esta herramienta prueba fuentes de desarrollo, no producto.
- El wrapper comparte runner, propaga fallos y timeout, rechaza argumentos
desconocidos y no hereda PYTHONPATH/user-site/secretos. Reutiliza el entorno
allowlisted del build existente. Contratos puros tienen plazo de 120 s y
formatos 180 s. Los tests de orquestación inyectan proceso simulado para probar
salidas, mientras la verificación local ejecuta Python real, sin falsas pruebas
de integración basadas únicamente en texto.
- verify:pr añade python-tools:test después de test:quality. CI y verify de
release preparan 3.12.11; QA local puede ser patch 3.12.14 y se registra. Falta
de intérprete falla con instrucción de selección; nunca es un skip verde.
- Workflow reutilizable de formatos, invocado desde CI y release, con matriz
Windows 2025 x64, macOS 15 ARM64, Ubuntu 24.04 x64/ARM64. Locks hashed y sólo
wheels, pip check y runner --formats, sin Node, voz, audio o modelos. Comprueba
SO/arquitectura/patch antes de instalar. Actions inmutables, checkout sin
credenciales, permisos contents:read. Los builds de release dependen también
de la matriz; la verificación es del mismo SHA, sin dispatch o publicación aquí.
- La matriz cubre los cuatro targets con wheels verificadas; no resuelve ni
oculta Intel. El workflow candidato de la unidad anterior permanece separado.
- La inspección del manifiesto oficial actions/python-versions mostró que
3.12.11 sólo se ofrece para Linux; setup-python no puede preparar ese patch en
macOS/Windows. Reutilizar los mismos cinco archivos Python standalone y SHA256
ya fijados por el proyecto, con preparación sólo de intérprete en temporal,
sin instalar voz/lector ni promover el runtime. Compartir descarga HTTPS acotada
con setup, comprobar hash antes de tar y versión/arquitectura antes de emitir
variables CI. Configurar también ese intérprete en el workflow candidato Intel.
La CLI exige --github-actions para publicar sus rutas en los archivos especiales
del job; local sólo devuelve un recibo, sin modificar PATH o configuración.
- Declarar yaml 2.9.0 como dependencia directa de desarrollo para contratos
estructurados de workflows; ya está instalada transitivamente. Licencia ISC,
sin hooks de instalación, sin dependencia nueva de producción. Comparar lock
y auditoría para no depender de una transitiva implícita.

## Risks / Trade-offs

Python pasa a ser prerrequisito local del gate: guía y override explícito, sin
instalación global automática. El job de formatos usa red/PyPI: integridad por
hash y sin fallback sdist. Labels alojados pueden cambiar: guardia de plataforma
evita certificar otra arquitectura. Instalar wheels no prueba audio o paquete
final. Configuración local de workflow no demuestra éxito remoto.

## Migration Plan

Pruebas rojas del wrapper e integración; implementar y ejecutar QA stdlib y
formatos temporal; integrar workflows/gate y docs; tipos/lint/full gate/build
con fuentes estables. Autorrevisión y evidencia, revisión independiente antes
de archivar. Reversión restaura sólo wiring de esta unidad, manteniendo locks y
barrera PDF anteriores; no hay runtime, perfiles o SQL que migrar.
