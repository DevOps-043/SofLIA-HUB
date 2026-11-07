# Progreso acumulado de deuda técnica

Estado: fotografía local del 25 de octubre de 2026 hasta la unidad 34, previa a la coordinación de intenciones Auth de la unidad 35; reducción en curso, sin certificación de producción.

Actualización posterior: la [reevaluación después de la unidad 37](technical-debt-reassessment-2026-10-25.md)
sí recalcula el índice: **40.88%**, aproximadamente **41%**. El contenido siguiente
conserva el corte anterior, cuando todavía no se había repetido la matriz.

## Porcentaje global

El [diagnóstico inicial](technical-debt-2026-10-19.md) estimó un índice experto
ponderado de **50.38%**, con confianza media y sensibilidad 40–60%. Es la línea
base del 19 de octubre, no una medición actual. No se ha repetido la evaluación
completa de sus 44 criterios: no existe todavía un porcentaje global actualizado
defendible. Ni las casillas cerradas ni las pruebas aprobadas lo sustituyen.

## Progreso comprobable

El [plan acumulativo](../plans/technical-debt-reduction.md) enlaza 34 unidades:
32 con checklist local resuelta y dos parciales. Suman 249 casillas marcadas y
dos abiertas en esas unidades seleccionadas. Esto no representa el porcentaje
del objetivo completo: quedan trabajos transversales no desglosados en ellas,
revisión independiente y validaciones externas. No se declaran 32 cambios
aprobados para producción o archivados.

| Indicador | Diagnóstico inicial | Última evidencia |
|---|---|---|
| Compuerta PR | Fallaba | Trece etapas aprobadas |
| Vitest | 4,438 aprobadas, un fallo, cinco omitidas | 5,951 aprobadas, cero fallos, cinco omitidas |
| Python | No ejecutado en la auditoría | 33 pruebas aprobadas dentro de la compuerta |
| Tooling | Sin equivalente agregado comparable | 51 pruebas aprobadas |
| Dependencias npm afectadas | 43 paquetes: 18 high, 25 moderate | Siete paquetes moderate; cero high/critical |
| Build aislado | No se acredita comparación histórica equivalente | Seis artefactos aprobados, sin .env |

La auditoría npm se repitió para este seguimiento y devolvió código 1 por sus
siete paquetes afectados, sin error de consulta. La cadena restante incluye
file-type/Jimp/nut-js; no son siete vulnerabilidades independientes demostradas.
Las auditorías inicial y actual son fotografías de fechas distintas, no una
atribución causal exacta de cada aviso retirado. El resultado no certifica
ausencia de vulnerabilidades. [Resumen reproducido](technical-debt-progress-2026-10-25.json).

La última [verificación completa](../../openspec/changes/guard-auth-lifecycle-results/reports/verification.md)
es local: Node 26.7.0, Electron 44.9.3, 418 archivos revisados por lint sin deuda
nueva, 781 Markdown con enlaces válidos y 3,514 fuentes congeladas. No equivale
a lint global limpio, cobertura de código medida, CI remoto o producto instalado.
Este seguimiento añade documentación; no repite el gate ni modifica producto.

## Avance y pendientes por área

| Área | Avance implementado | Falta principal |
|---|---|---|
| Seguridad y privacidad | Custodia por propietario, OAuth vinculado, guardas IPC/HITL en calendario, Gmail, voz, documentos y Project Hub | Retirar claves compartidas del bundle, revisar IPC restante y completar aislamiento efectivo del servidor |
| Sesiones e integridad del chat | Colas coordinadas, protección de contenido/cache, revocación por ciclo SDK y cancelación de restauración/eventos | Arbitraje global entre login/SSO/reintentos/cierre; coordinación entre ventanas/equipos |
| Arquitectura y modularidad | Responsabilidades de checkpoint, recursos, percepción y recuperación del navegador y sidecars con contratos propios | Otras responsabilidades concentradas, tipos débiles y errores silenciosos fuera de las fronteras intervenidas |
| Calidad de código | Reparación y endurecimiento del lint incremental y sus baselines | Reducir deuda histórica de any, hooks y manejo de errores; cero incidencias nuevas no significa cero deuda total |
| Datos | Inspección de contratos, mayor ownership local y recuperación de escrituras | RLS por actor/organización en SOFIA/Lia/IRIS y borrado transaccional de proyectos |
| Dependencias | Actualizaciones compatibles, locks/hashes y barreras de versiones vulnerables | Cadena file-type/Jimp/nut-js; artefacto seguro Python macOS Intel y validación nativa por plataforma |
| CI/CD y publicación | Gate ligado al commit, Node de CI alineado, build Linux y contratos Python integrados | Ejecutar CI/matriz real, instalar y validar candidatos, firma/notarización y cuentas reales |
| Observabilidad y operación | Logs seguros y correlación en superficies intervenidas, telemetría tool minimizada | Adopción global, retención/custodia del historial, alertas, respaldo/restauración y RPO/RTO |
| Rendimiento | Cancelación de trabajo obsoleto y presupuestos de recursos/parsers | Carga representativa, p95/p99, EXPLAIN, paginación y presupuestos medidos en CI |
| Documentación y gobierno | Runbooks corregidos, contratos/evidencia actualizados y validadores aprobados | Revisión independiente, cierre documental y reauditoría comparable del índice global |
| Accesibilidad y UX | Teclado/foco/ARIA del selector y propiedad/modalidad de confirmaciones | Revisión visual pendiente, axe/lector de pantalla y flujos completos en producto instalado |

## Orden de prioridad restante

1. Claves compartidas distribuibles y arbitraje global de autenticación.
2. Aislamiento de datos y borrado transaccional IRIS. La [inspección del 22 de octubre](iris-access-2026-10-22.md) encontró 30 tablas sin RLS; esa remediación no está aplicada ni revalidada remotamente en este seguimiento.
3. Dependencias residuales y candidato macOS Intel. El usuario confirmó que no dispone de ese entorno; no se acredita su validación.
4. Cobertura por rutas críticas, CI/matriz, instaladores y accesibilidad visual. La apertura del archivo de la confirmación fue rechazada automáticamente por la política del navegador; no se buscó otra vía para abrirlo.
5. Tipado y modularidad restantes, operación/retención/restauración, carga y revisión independiente.

No se publicaron cambios ni se aplicó SQL. Las correcciones acumuladas siguen
en el worktree de la rama `codex/reduce-technical-debt`; validación local no
implica despliegue. Las funcionalidades nuevas pendientes del proyecto no se
clasifican automáticamente como deuda técnica.
