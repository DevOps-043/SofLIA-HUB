# Verificación de selector compartido e inspección IRIS

Fecha: 2026-10-22. Rama: codex/reduce-technical-debt.
Base: e166d250629e503cf12f69449fb6d66e569134c8.
Estado: implementada y verificada localmente; revisión independiente pendiente.

## Resultado

SelectDropdown conserva [diez props y cuatro campos del tipo exportado](api-comparison.json), mantiene valor controlado y
explora opciones habilitadas por identidad. Corrige confirmación por índice
obsoleto, referencias ARIA inválidas, etiqueta externa perdida, propagación de
Escape y cierre/foco. Agrega prefijos de 500 ms, sin interferir con atajos/IME
ni instalar timers, y evita reaperturas latentes después de vaciar/deshabilitar.

La medición en Chromium también reprodujo una altura animada intermedia:
style.maxHeight=65,4 px con clientHeight=158 px; el foco quedaba fuera al terminar
la transición. duration-150 afectaba transiciones con propiedad inicial all.
Se separó duración de animación y transition-none. El desplazamiento local se
recalcula con layout/posición, respeta el scroll del usuario y no mueve los
ancestros del diálogo. La opción final queda dentro del popup sin tolerancia
geométrica añadida. Las capturas usan datos ficticios; no aparecen cuentas reales.

## Evidencia dirigida

Logs propios: `%TEMP%/soflia-select-interaction-2026-10-22/`.

| Caso | Resultado registrado |
|---|---|
| Baseline del selector | Seis pruebas, salida 0; baseline.log. |
| Reproducción previa | Nueve fallos nuevos y seis casos previos aprobados; red.log, salida 1. |
| Selector + StudioProduction + StudioProgram | 48 casos en tres archivos, salida 0; directed-reviewed.log. Son 26 casos nuevos del selector frente a su baseline de seis. |
| Tipos y lint | Aprobados dentro de la compuerta final; 146 archivos sin deuda nueva. El primer lint detectó reloj en helper inferido como render y fixture sin export; se corrigieron con timestamp de evento y export de componente, sin desactivar reglas. |
| Smoke nativo | Seis comprobaciones aprobadas: AX/nombre, Escape, identidad, foco/Tab, zoom/movimiento y scroll. Foco emulado por CDP en ventana oculta; [informe](native-select.json), native-reviewed-delivery.log y [captura/huella](visual-check.json). |
| Documentación | Inventario derivado: 630 archivos de prueba, 494 canales; validación estricta OpenSpec aprobada. |
| npm run app:smoke:build | Salida 0, seis artefactos y 3314 fuentes. Sin .env, empaquetado ni bootstrap; [resumen](build-summary.json), [hashes](build-artifacts.json), build-reviewed.log. |
| Primer verify:pr | Salida 0: 4895 casos y cinco omitidos, 230,14 s de suite; verify-pr.log. La revisión posterior motivó corrección y repetición. |
| Colisión de IDs posterior al primer gate | Un fallo reproducido con device/device-listbox, id-collision-red.log. Se restableció useId y el formato original interno; nueva regresión aprobada dentro de los 48 casos. |
| npm run verify:pr final | Salida 0: 4896 casos aprobados y cinco omitidos; 460 archivos aprobados y dos omitidos. Suite de 213,50 s; verify-pr-final.log. Arnés, documentación, tipos, tooling y lint aprobados. |

Los primeros smokes aislaron dos supuestos del arnés: una ventana oculta sin
foco no emite focusin/focusout, y transición desactivada se verifica mediante
transition-property=none, no por duration=0. Se corrigió el arnés; posteriormente
sus medidas permitieron localizar y corregir el problema real de altura. No se
ocultan esos intentos ni se declaran aprobados. Los diagnósticos adicionales
quedaron sólo en carpetas temporales propias.

## Seguimiento de integridad y seguridad IRIS

La [inspección efectiva](../../../../docs/reports/iris-access-2026-10-22.md)
consultó catálogos y asesores, sin datos de negocio, secretos ni escrituras.
Confirma 30 tablas públicas sin RLS y membresías permisivas sin actor. Se
conservan [metadatos](../../../../docs/reports/iris-access-2026-10-22.json) y
[SQL de sólo lectura](../../../../database/iris/audits/project-deletion-preflight.sql).
El contrato v1 no expone borrado y no hay equivalencia demostrada de identidad
con auth.uid() IRIS; una transacción requiere servidor autorizado y rollout de
consumidores/permisos. No se cambió eliminación por archivado ni se inventó RPC.
Este hallazgo sigue pendiente y no cuenta como remediación de RLS/integridad.

## Límites y reversión

No hay auditoría de lector de pantalla, axe global, contraste de todas las
pantallas, instalador ni certificación WCAG. La ventana nativa está oculta,
usa foco/media emulados y contenido local; bloquea solicitudes de red. El build
aislado excluye .env y no arranca bootstrap. No se recalcula deuda global.

Revertir control y módulo de navegación juntos conserva API y no requiere
migraciones. Los reportes IRIS son evidencia de sólo lectura, sin efecto que
revertir. Se conservan diez unidades anteriores, sin commit ni publicación.
Revisión independiente pendiente antes de archivar.
