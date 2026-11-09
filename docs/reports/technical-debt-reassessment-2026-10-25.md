# Reevaluación del índice de deuda técnica

Estado: repositorio local al 25 de octubre de 2026 (America/Mexico_City), después de la unidad 37. No acredita despliegue.

## Dictamen

**Deuda técnica global actual estimada: 40.88%, aproximadamente 41%.**
Antes del lote: **43.25%**. Reducción de este lote:
**2.38 puntos porcentuales**.
Frente al diagnóstico inicial de 50.38%, la reducción acumulada es
**9.50 puntos**.

Es un índice experto de brechas, con confianza media; los decimales documentan
la suma, no precisión física. No mide proporción de código defectuoso, horas
de reparación o costo SQALE. Sensibilidad orientativa 35–50%, no intervalo
estadístico. Cobertura de pruebas y deuda técnica son métricas distintas.

## Método y comparación

Se conservan los once pesos y 44 criterios del
[diagnóstico inicial](technical-debt-2026-10-19.md). Escala ordinal 0 satisfecho,
25 brecha menor/localizada, 50 parcial, 75 material y 100 control esencial
ausente. Cada área promedia cuatro criterios y el total suma peso por promedio
dividido entre cien. La revisión es dirigida por riesgo/evidencia, no una
auditoría manual exhaustiva ni certificación de producción.

| Área | Peso | Inicial | Unidad 36 | Actual |
|---|---:|---:|---:|---:|
| Seguridad y privacidad | 20% | 50.00% | 50.00% | 50.00% |
| Arquitectura y modularidad | 12% | 43.75% | 43.75% | 43.75% |
| Calidad de código y tipado | 12% | 43.75% | 37.50% | 37.50% |
| Pruebas y calidad funcional | 15% | 56.25% | 43.75% | 31.25% |
| Datos e integridad | 10% | 43.75% | 50.00% | 50.00% |
| Dependencias y cadena de suministro | 8% | 56.25% | 18.75% | 18.75% |
| CI/CD, empaquetado y publicación | 8% | 68.75% | 43.75% | 37.50% |
| Observabilidad y operación | 5% | 56.25% | 50.00% | 50.00% |
| Rendimiento y escalabilidad | 4% | 50.00% | 50.00% | 50.00% |
| Documentación y gobierno | 3% | 25.00% | 31.25% | 31.25% |
| Accesibilidad y UX | 3% | 50.00% | 50.00% | 50.00% |
| **Total ponderado** | **100%** | **50.38%** | **43.25%** | **40.88%** |

Los [44 criterios, puntuaciones y fuentes con hashes](technical-debt-reassessment-2026-10-25.json)
permiten reproducir la suma. Sólo cambian dos criterios:

- Cobertura medida y umbrales: **75 → 25**. Ahora hay medición de las 2563
  fuentes productivas, incluso no importadas, y control obligatorio de
  inventario, métricas, sumas y pisos en la compuerta. Persiste una brecha menor
  del control: pisos iniciales y CI remoto pendiente; no se declara cobertura
  funcional suficiente de todo el producto ni un objetivo de 80/90%.
- Firma/notarización e inmutabilidad: **75 → 50**. Se eliminan las 18 referencias
  mutables y se impide reintroducirlas con una política que revisa dependencias
  locales compuestas. Firma Windows y notarización Apple permanecen pendientes,
  por eso el criterio queda parcial.

Las otras 42 franjas se conservan. No se restan puntos por cantidad de pruebas,
líneas o casillas. No hubo refactor funcional src/electron en este lote: se
redujeron carencias transversales de QA/entrega conservando la modularidad.

## Evidencia actual

La [verificación del lote](../../openspec/changes/gate-global-quality-and-workflow-integrity/reports/verification.md)
registra catorce controles con código 0, una sola suite final con cobertura,
6053 Vitest aprobadas y cinco omitidas, 62 tooling y 33 Python, tipos/lint y
seis artefactos de build aislado. Lint incremental: 454 archivos sin deuda
nueva. Los hashes de las 3533 fuentes fueron idénticos antes/después de gate
y build; también coinciden al reevaluar. Sin .env, instalador o inicio de app.

La cobertura final original incluye exactamente las 2563 fuentes productivas:
líneas **56.92%**, sentencias **55.61%**, funciones **51.70%** y ramas **49.60%**.
Hay 1023 archivos con sentencias instrumentables sin ejecución. Los pisos
globales son 56/55/51/49, la parte entera del baseline; dejan un margen inferior
a un punto y no garantizan evitar cualquier caída dentro de ese margen.
El ensayo inicial añadió por remapeo tres mocks de pruebas: se identificaron y
excluyeron como fixtures, sin omitir producción; el verificador exige inventario
exacto para impedir que un reporte parcial se presente como global.

Los cuatro workflows contienen 27 referencias: 25 remotas fijadas y dos locales.
La política rechaza tags/ramas, expresiones, docker:// sin digest, escapes,
enlaces y YAML inválido, también en actions compuestas locales fuera de .github.
No certifica todo el código de Actions ni equivale a firma/notarización.

Auditorías npm completa y producción repetidas: siete paquetes moderate,
cero high/critical; mismos nodos afectados y sin avisos exclusivamente dev.
ESLint src/electron conserva 2009 errores y 31 avisos, sin fatales; producción:
1589 errores, 31 avisos y 1416 mensajes no-explicit-any. Se reutiliza esa
medición porque cada fuente de esos árboles y eslint.config.mjs conserva su
hash; el tooling nuevo y configuración Vitest aprobaron lint dirigido y gate.
No se oculta el baseline histórico ni se cambian dependencias/lock.

Gobierno actual: 108 cambios OpenSpec,
80 sin casillas abiertas y
191 casillas abiertas. Checklist no equivale
a revisión independiente, archivo o producción. Logs, baseline y respaldos:
%TEMP%/soflia-global-quality-2026-10-25/. El JSON conserva la comparación/hash
del informe anterior y los recibos del estado final.

## Brechas que siguen pendientes

RLS/ownership y borrado transaccional IRIS; claves compartidas en cliente y
autorización IPC aún heterogénea; concentración del navegador y tipado débil;
cobertura funcional/E2E y CI Node 24; instaladores, firma/notarización y lector
seguro macOS Intel; correlación/alertas/retención; carga de 800 usuarios sin
demostrar; runbooks con desfase; accesibilidad integral y revisión independiente.
La inspección RLS sigue siendo la del 22 de octubre, sin consulta/remediación
remota nueva. Se respeta el rechazo GUI previo, sin intentar otra vía.

No se accedió a secretos/.env ni registros de negocio. Sin SQL, stage/commit/push,
instalación, firma o despliegue. Node local 26.7.0 y Electron 44.9.3; las
limitaciones externas no se cuentan como controles cerrados.
