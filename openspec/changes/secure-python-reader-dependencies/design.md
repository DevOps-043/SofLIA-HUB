## Context

Ver context-pack y propuesta. El runtime fijado es CPython 3.12.11, con cinco
targets: Windows x64, macOS x64/arm64 y Linux x64/arm64. QA disponible es 3.12.14.
Setup prepara staging, importa voz/documentos y sólo entonces promociona con
respaldo; su caché usa hashes de dos entrypoints, sin cierre transitivo del lector.

## Goals / Non-Goals

**Goals:** retirar el pin PDF conocido como vulnerable, fijar cierre del lector
con artefactos comprobables y detectar runtime viejo antes de interpretar PDF.

**Non-Goals:** auditar/fijar toda voz o Node, ejecutar exploits, modelos/audio,
instalador/release, hardware o certificar ejecución en SO no disponibles.

## Decisions

- Usar avisos del mantenedor y JSON PyPI como fuentes primarias; guardar versiones,
dependencias, advisories y hashes antes/después. pdfplumber 0.11.10 exige
pdfminer.six 20260107, posterior al parche 20251230. Resolver lectores y closure
en venv temporal con pip aislado/índice oficial/wheels; no tocar runtime real.
- Fijar closure en requirements.lock con hashes de wheels admitidas en los cinco
targets y directos en el entrypoint por referencia al lock. No incluir sdist.
Hashes vinculan bytes al índice consultado; no prueban inocuidad ni procedencia
fuera de esa relación. Verificar disponibilidad/tags con descarga por plataforma.
- Pip activa require-hashes para todo el comando si encuentra hashes: instalar
voz y lector en pasos separados dentro del mismo staging, lector con
--require-hashes --only-binary=:all:. Validar pip check e imports completos y
versiones exactas del lock antes de promocionar, conservando respaldo. Comprobar
también resolución conjunta para detectar conflictos de dependencias compartidas.
- Centralizar archivos del fingerprint (voz, entrypoint lector y lock) en helper
Node reutilizado por setup y smoke. Incluir bytes del lock; cambiar sólo éste
debe invalidar caché. No promover staging fallido ni borrar runtime previo.
- Política Python pequeña comprueba metadata de pdfminer.six antes de importar
pdfplumber en lectura PDF. Versiones anteriores a 20251230, ausentes o con
formato inverificable fallan con DEPENDENCY_INCOMPATIBLE. No se deserializa un
payload de prueba. Durante setup se comprueba además concordancia exacta del
lock en el intérprete candidato antes de importar las bibliotecas.
- Reutilizar catálogo de errores main y transporte/API existentes. No crear IPC
ni cambiar permisos. La barrera es respaldo para runtimes antiguos, no prueba
criptográfica de una instalación ni sustituto del lock/auditoría.
- Ampliar runner stdlib a la política/lock y ejecutar formatos/privacidad/stdio
con los pins exactos en venv aislado. Registrar diferencia de patch CPython y
que descargar wheels para otros targets no equivale a ejecutarlas allí.

## Risks / Trade-offs

Wheels nativas y dependencias compartidas pueden causar conflictos: resolución
conjunta y pip check/metadata antes de promover; fallo conserva runtime previo.
Lectura PDF con runtime antiguo se rechaza hasta actualizar; no desactivar la
barrera como rollback. Avisos públicos no cubren vulnerabilidades desconocidas.
Voz conserva su política actual y no se certifican modelos/audio ni todo su árbol.

## Migration Plan

Regresiones de política/fingerprint; baseline de metadata sin ejecutar versiones
vulnerables; resolver/generar lock; integrar setup y guardia; instalar pins en
venv temporal, validar formatos/closure/plataformas; docs, autorrevisión y
gate/build. Revisión independiente pendiente antes de archivar. Sin promoción
local ni despliegue. Rollback a otro lock verificado; nunca volver a aceptar el
pdfminer antiguo ni afirmar que se actualizaron instalaciones desplegadas.
