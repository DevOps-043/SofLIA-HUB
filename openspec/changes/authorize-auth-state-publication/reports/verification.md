# Verificación de publicación Auth por fuente nativa

Estado: implementación verificada localmente con compuerta completa y build aislado aprobados. Revisión independiente pendiente, sin archivar. No acredita despliegue.

## Alcance y causa

La comprobación de integración del 7 de noviembre de 2026 pasó 248 casos
dirigidos de publicación Auth, documento nativo, Project Hub y vigencia de
intenciones. Una sesión SOFIA rechazada devuelve un resultado fallido antes
de aplicar Lia o iniciar el canje Project Hub.

La simulación textual de siete archivos contra `0dc4d698` y `18cec138`
detectó conflictos en seis con cada destino. Ambos destinos eliminan del
handler el canje inicial de Project Hub. En esos commits no se identificó
otro consumidor productivo de `exchangeSofiaToken`. La integración debe
preservar el canje verificado y reconciliar el selector de organización del
destino con la invalidación de lecturas locales por cambio de sesión.

El handler anterior no validaba emisor, marco o documento; Orbe podía publicar
o cerrar por main aunque el publicador React lo excluyera. Tipos no válidos de
token se normalizaban a ausencia y no había cuotas. La selección de organización
se actualizaba antes de verificar SOFIA. Las respuestas no devolvían tokens,
pero cualquier emisor podía consultar la identidad actual.

Ahora sólo Hub publica y Hub/Orbe leen desde sus ventanas/webContents/marcos
principales reales registrados y documento propio. Los getters vivos permiten
registrar antes de crear ventanas. La lease de fuente no requiere sesión; la
guarda existente compone fuente más identidad, sin relajar consumidores.
Payload cerrado de siete campos, límites de ID/token y pares completos preceden
servicios. Revocación normaliza los campos a null. La organización se actualiza
al publicar el estado verificado. Errores del proveedor no entran en resultados
ni logs; se conserva la forma ok/state y los mismos canales allowlisted.

## Evidencia dirigida

Logs y JSON completos en `%TEMP%/soflia-auth-publication-2026-10-25/`.

- Regresión previa: source-red.json registra 31 fallidas y 13 aprobadas, antes
  de cambios de producto: doce casos originales y uno nuevo ya aprobaban. Son
  fallos de comportamiento, sin errores de importación.
- Primera implementación: las 44 pruebas de contrato aprobadas.
- Consumidores: seis archivos dirigidos aprobados. Revisión ampliada:
  adversarial.json registra 363 aprobadas en once archivos, cero fallidas.
- Se agregan 64 casos: 48 a los doce existentes de Auth y 16 de fuente/
  composición. Incluyen recorrido wrapper → preload seguro/allowlist → handler
  → servicios, fallos, argumentos extra, emisor antes de payload, cuotas exactas,
  rechazo de Orbe, navegación principal/subframe, A/B/A y limpieza.
- Typecheck inicial detectó Promise<void> frente a Promise<undefined> en un mock
  de logout; se corrigió sin cambiar producción. Typecheck posterior y lint
  dirigido de los primeros diez archivos aprobaron. La compuerta final vuelve
  a comprobar el estado final, incluido el nuevo archivo de pruebas.

## Revisión adversarial propia

Se intentó refutar: rechazo antes de parsear mediante getter que lanzaría;
suplantación por URL igual con otro objeto de frame; cierre del Hub desde Orbe;
lectura de identidad por emisor ajeno; pérdida de publicación válida por intento
inválido simultáneo; navegación/caída/reemplazo durante SOFIA, Lia, canje o
revocación; falla tardía que cierre la identidad posterior; pares/tipos/límites
malformados; listeners que retiren suscripciones ajenas; pérdida del requisito
de sesión en consumidores al extraer fuente. Casos dirigidos cubren esas
hipótesis y conservan los consumidores autenticados.

La revisión propia no sustituye revisión adversarial independiente. No se
solicita ni declara archivo del cambio mientras falte esa revisión.

## Límites y reversión

Puertos de ventanas/IPC y proveedores SDK sustituidos; no se crean ventanas ni
se ejecuta GUI o cuentas/red reales. La revisión visual bloqueada anteriormente
conserva el rechazo: no se intenta otra vía. Los tipos Electron instalados
44.9.3 confirman los argumentos posicionales de navegación aún admitidos; se
atienden también los detalles de la API actual. [Referencia oficial de validación de emisores](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

Una llamada SDK ya admitida puede persistir o mutar internamente mientras se
espera; la lease impide pasos posteriores y resultados tardíos, sin rollback
físico, compensación global que cierre otra sesión ni atomicidad de toda la
sesión main. El gate ya publicado antes de esperar Lia/canje no se revoca sólo
por navegación: los servicios main de fondo conservan su ciclo. No se modifica
la política legacy sin SOFIA, JWT/RLS, ownership del servidor, XSS de una ventana
principal válida ni otras superficies IPC. Si I/O no responde, su handler espera.

Respaldos de seis archivos existentes en TEMP/before. Revertir sólo el delta de
esta unidad y retirar sus cinco fuentes nuevas, preservando cambios previos.
Sin secretos/.env, SQL, dependencias, stage/commit/push, instalador o despliegue.
43.25% sigue siendo el último índice global calculado después de la unidad 35;
esta unidad no resta puntos automáticamente.

## Verificación final

`npm run verify:pr` completó trece etapas con código 0 en 340.71 s:

- Vitest: 6,053 aprobadas y cinco omitidas; 517 archivos aprobados y dos omitidos
  (519 total), duración 205.74 s. Se conservan las 5,989 aprobadas anteriores y
  se agregan 64 casos. El conteo dirigido de Auth incluye doce casos previos,
  no trece: entre los trece verdes del ensayo rojo había un caso nuevo.
- Tooling: 51 aprobadas. Python 3.12.11: 33 aprobadas con intérprete QA temporal
  explícito. Tipos, harness, runtime estable, supply-chain y specs aprobados.
- Lint incremental: 450 archivos sin deuda nueva. Enlaces válidos en 795 Markdown.
  Inventario sincronizado: 702 archivos relacionados con pruebas, no suites.

`npm run app:smoke:build` terminó con código 0 en 80.86 s en
`pulse-app-build-vSqvTO`: seis artefactos no vacíos, 3,508 fuentes copiadas con
hash coincidente. Enumera 3,509 rutas, incluida la eliminación preexistente
electron/wa-agent/bulk-label-verification.ts, preservada y omitida al copiar.
Sin .env, instalador, inicio de app ni publicación. Persisten avisos conocidos
del bundler sobre tamaño de chunks/imports.

Las 3,528 fuentes fueron idénticas antes/después de ambos procesos terminales.
SHA256 del manifiesto:
`79822107c1679939ebeb504f49fd499f3f86075eef6f5493674f2919bed3b7bd`.
Contra la unidad 35 cambian exactamente seis fuentes y se agregan cinco. Los
seis respaldos coinciden con el manifiesto anterior; package.json y lock no
cambian. El diff de archivos intervenidos no presenta incidencias de espacios.
El diff global devuelve código 2 por diez líneas vacías finales preexistentes
en archivos fuera de esta unidad: sus hashes coinciden con la unidad 35 y se
enumeran en el recibo de fuentes. No se declaran corregidas ni como regresiones.

Recibos: [regresión y 363 casos dirigidos](regression-summary.json),
[compuerta](gate-summary.json), [build](build-summary.json),
[fuentes](source-evidence.json) y [logs](log-evidence.json).
Node local 26.7.0 y Electron 44.9.3. CI Node 24, otros SO, GUI/cuentas reales
y revisión independiente no se acreditan. Tras ambos procesos sólo cambian
documentación/tareas/recibos, con comprobaciones documentales posteriores.
