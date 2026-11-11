## Context

Ver propuesta/context-pack. Diez ejecuciones aisladas de policies-only pasaron
sus 19 casos; no demuestran la causa del fallo anterior ni su eliminación.
El hallazgo de plazo es independiente: cuatro motores duplican Date.now y
consumo, con validación temporal sólo al entrar en varias rutas.

## Goals / Non-Goals

**Goals:** vigencia efímera de como máximo cinco minutos, consumo único y
revalidación antes de nuevos efectos, con guardas actor/bytes actuales.

**Non-Goals:** cambiar formatos, relojes de metadata/retención, confirmación HITL,
permisos fuera de estas recuperaciones, primitivas criptográficas o SQL remoto.

## Decisions

- Primitiva interna común sin configuración pública: plazo de cinco minutos y
consumo único. Capturar dos límites: reloj monotónico process.hrtime.bigint y
reloj de pared. Vencer por cualquiera queda memorizado. El monotónico impide
extender por retroceso; conservar límite de pared falla restrictivamente ante
adelantos/suspensión donde el reloj monotónico pueda no incluir reposo.
- El reloj de intervalos no depende de hora civil, según la
[API Node](https://nodejs.org/api/process.html#processhrtimebigint). No se promete
defensa ante un administrador que sustituya ambos relojes o modifique main.
No se persiste un plazo de proceso ni se usa para timestamps de negocio.
- Mantener mensajes públicos actuales: la primitiva devuelve estado booleano y
los motores conservan sus errores controlados. No incluir causas, paths o
payloads de terceros en logs. Consumo y comprobación de vigencia son distintos:
una revisión consumida aún necesita revalidarse tras esperas antes de publicar.
- Componer comprobación temporal con guardas existentes, pasándola a funciones
de publicación. Comprobar después de cola/I/O/proyección y antes de iniciar
rename/link/escritura pública. No afirmar cancelación/rollback de syscall ya
iniciada dentro del plazo.
- Si sync coordinado vence después de crear marcador, conservar el marcador y
bloquear lecturas/escrituras hasta otra revisión/rollback. No retirar el diario
para convertir una aplicación parcial en éxito. Limpiar sólo temporales propios
cuando falle una publicación no comprometida, como en el contrato existente.

## Risks / Trade-offs

Se reprodujo además EPERM de rename en Windows, sin identificar el proceso que
retenía el archivo histórico. Un fixture con FileShare.Read lo genera de forma
determinista. Sólo la publicación asíncrona de políticas reintenta EPERM/EBUSY
en Windows con esperas de 20/40/80/160 ms (cinco intentos). No se reintenta
EEXIST, otros errores, link exclusivo ni otros SO. No se elimina el destino
para publicar ni se amplían timeouts globales. Antes de cada intento se revisan
actor/plazo y bytes esperados de destino/archivos asociados. Un cambio ajeno o
revocación termina el intento; el archivo preparado se limpia. Los motores
síncronos conservan su contrato sin introducir esperas bloqueantes de main.

La limpieza de cuarentenas de políticas/SQLite requiere publicación efectiva
por esta operación; asignar una ruta no acredita propiedad. Un link exclusivo
fallido no autoriza eliminar el destino. Si falla limpiar una cuarentena propia,
se conserva el error original y un aviso estático declara el residuo protegido.

Reloj adelantado puede exigir otra revisión antes de cinco minutos → rechazo
restrictivo compatible con el límite anterior. Efectos iniciados pueden terminar
después del límite → documentar frontera de autorización y conservar journals.
Pruebas de reloj no deben alterar el SO → stub local de Date/hrtime sólo en QA,
restaurado en finally. La revisión independiente sigue pendiente.

## Migration Plan

Reproducción roja, primitiva/contratos, integración de los cuatro motores y
casos de I/O, proyección y marcador. Native con DPAPI real y archivos ficticios;
gate/build con fuentes congeladas. No hay migración persistente. Reversión
selectiva debe conservar límites temporales y rechazos probados; no restaurar
Date.now como única medida ni deshacer unidades previas.
