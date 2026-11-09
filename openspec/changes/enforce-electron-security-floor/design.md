## Context

Ver propuesta/context-pack. El checker comprueba estabilidad, excepción temporal
y concordancia de cuatro fuentes, incluyendo ejecutar Electron como Node. Sólo
verify:release lo invoca. El aviso del mantenedor declara rangos afectados en
42/43/44/45 y no ofrece workaround de aplicación. El pin instalado es 44.5.1.

## Goals / Non-Goals

**Goals:** runtime con mitigación publicada y barrera de regresión verificable
en PR, conservando API, perfiles y capas del sistema.

**Non-Goals:** una auditoría completa de Chromium/Node, certificar MITM real o
revocar certificados del SO; no se despliega ni se prueba instalador.

## Decisions

- Elegir 44.9.3 estable, manteniendo mayor 44; registro npm, notas Electron y
aviso del mantenedor como fuentes primarias. Resolver lock sin hooks primero,
revisar diferencias y luego instalar con scripts desactivados, invocando sólo
el instalador Electron revisado. Conservar el paquete/binario previo fuera del
repo, no restaurar una versión vulnerable como salida funcional.
- Separar estabilidad de política de seguridad para que la excepción beta
existente siga documentándose pero nunca suprima un rango afectado. Incorporar
comparación semver formal con includePrerelease, evitando comparador numérico
casero para 45.0.0-beta.6. semver 7.8.5 ya está instalada, licencia ISC, sin
hooks de instalación; declararla dev explícita. Sólo añade dependencia directa
de desarrollo, no otra versión/binario ni superficie del renderer.
- Política específica del aviso GHSA-jr5w-w6x2-84p9: <42.11.16,
>=43.0.0-0 <43.8.1, >=44.0.0-0 <44.9.1 y >=45.0.0-0 <45.0.0-beta.6.
Formato exacto inválido falla cerrado. Las comparaciones son por versiones,
incluidas prereleases; no se afirma cubrir avisos desconocidos o futuros.
- Combinar guardas antes de comprobar lock/paquete/binario, con diagnóstico
seguro y referencia al aviso. Llevar runtime:stable a PR; verify:release agrega
sólo build a la misma cadena y no repite esa etapa.
- Smokes existentes, Electron nuevo real, perfiles temporales y datos ficticios:
preload/IPC documental/voz, custodia y navegador. Son regresiones de consumidores,
no una reproducción del certificado comprometido. Usar versión/checksum del
runtime como evidencia de incorporar el parche publicado, sin TLS externo.

## Risks / Trade-offs

Cambios de Chromium/nativo pueden romper consumidores: gate, build y smokes con
el ejecutable nuevo. Nueva etapa PR requiere bibliotecas nativas del host para
Electron modo Node; no ocultar errores del entorno. Hashes identifican bytes
respecto de la fuente, no garantizan todo el suministro. La política versionada
necesita mantenimiento al publicarse otros avisos; no equivale a npm audit.

## Migration Plan

El primer smoke completo detectó una expectativa legacy en zoom.cjs:
getZoomFactor=1 pese a usar zoom nativo aislado de Electron 44. El fixture ahora
exige la API nativa y el factor aplicado. El botón de color fija borde/padding
a cero para medir el rectángulo, sin variación del estilo UA. Se mantienen las
tolerancias y comprobaciones de pestaña vecina, viewport, bitmap, input, Ctrl+
rueda y PDF; no se cambia el producto para acomodar la prueba.

Baseline/audit/metadata y pruebas rojas; resolver/revisar lock; preservar binario
anterior, instalar paquete nuevo y verificar descarga; implementar barrera/gate;
smokes, docs, autorrevisión, gate/build con fuentes estables. Sin promoción ni
release. Revisión independiente antes de archivar. Rollback sólo a otro runtime
parcheado verificado manteniendo la barrera, no al 44.5.1 vulnerable.
