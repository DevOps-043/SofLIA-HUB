# **Sistema de Documentación Operativa AI‑Native para SofLIA** (historico)

> Archivado el 2026-08-11. No es normativo: describe el SDO-AN, el registro
> operativo gobernado que llego al producto como "Registro de decisiones" y que
> fue retirado por completo (vista, canales IPC `sdo:*`, herramientas de agente
> y tablas `sdo_*`). Se conserva solo como investigacion.


**Fecha de corte de la investigación: 17 de julio de 2026\.**

## **1\. Resumen ejecutivo**

La recomendación central es construir un sistema híbrido y agnóstico de proveedores en el que:

1. La unidad principal no sea el documento, sino el **registro operativo gobernado**: una decisión, afirmación, acuerdo, responsabilidad, tarea, riesgo, cambio, aprobación o evidencia.  
2. Los documentos sean **representaciones narrativas y vistas editables** de esos registros.  
3. Google Docs funcione como superficie de redacción, colaboración, comentarios y aprobación humana.  
4. Una base estructurada conserve identidad, estado, autoridad, vigencia, relaciones, fuentes y trazabilidad.  
5. Las fuentes originales y versiones oficiales permanezcan como evidencia verificable e inmutable.  
6. La IA pueda localizar, extraer, comparar, clasificar y proponer; pero no conferir autoridad ni formalizar compromisos materiales.

### **Definición formal propuesta**

El Sistema de Documentación Operativa AI‑Native de SofLIA —SDO‑AN— es un sistema sociotécnico, independiente de plataformas, que captura evidencia empresarial, la convierte en registros operativos estructurados, gobierna su autoridad, vigencia, confidencialidad, procedencia y retención, y genera documentos y respuestas verificables para personas y agentes de IA.

Su principio fundamental sería:

**La IA puede producir contenido; únicamente una fuente autorizada y un proceso de aprobación pueden convertirlo en información oficial.**

### **Veredicto sobre la hipótesis**

La hipótesis es **correcta con una salvedad**:

* El documento ya no debe ser la única ni la principal unidad de conocimiento operativo.  
* Sin embargo, sigue siendo necesario para contratos, políticas, procedimientos narrativos, entregables, comunicación humana, aprobaciones y preservación de una versión legible.  
* Por tanto, no se sustituye el documento: se le quita la responsabilidad imposible de representar, por sí solo, toda la verdad operativa.

ISO 15489 ya reconoce que los registros pueden existir como datos, documentos u otras formas de información; sus principios se diseñaron para administrar evidencia contextualizada a través del tiempo, no solamente archivos tradicionales. [ISO 15489-1:2016](https://www.iso.org/standard/62542.html), [explicación de ISO sobre registros digitales](https://www.iso.org/news/2016/04/Ref2072.html).

---

## **2\. Diagnóstico y mapa de causas**

El problema de SofLIA no parece ser falta de documentos, sino falta de un mecanismo para determinar qué parte de esos documentos tiene autoridad.

| Causa | Consecuencia | Corrección AI‑Native |
| ----- | ----- | ----- |
| Agendas, minutas y alcances contienen mezclas de hechos, ideas y propuestas | Todo parece tener el mismo nivel de validez | Separar afirmaciones, decisiones, tareas y propuestas |
| No existe una autoridad explícita para cada decisión | Nadie sabe quién puede cerrar el asunto | Asignar un único Decision Owner |
| La última versión de un archivo se confunde con la versión vigente | Una edición reciente puede desplazar información aprobada | Registrar aprobación, vigencia y sustitución fuera del archivo |
| Las minutas registran conversaciones, no necesariamente decisiones | Una intervención se interpreta como compromiso | Requerir decisión, aprobador, fecha y fuente |
| Los pendientes están enterrados en texto narrativo | No se conocen responsable ni fecha | Extraerlos a un registro estructurado de acciones |
| Los documentos no caducan ni se revisan | Procedimientos y alcances obsoletos siguen circulando | `valid_from`, `review_due`, `valid_until`, `supersedes` |
| La IA puede redactar con seguridad aparente | Una inferencia puede convertirse en “hecho” | Estado epistemológico, citas, revisión y restricciones de publicación |
| Cada plataforma conserva una parte distinta | Fragmentación y dependencia del proveedor | Identificadores comunes, APIs y formatos abiertos |
| No existe reconciliación entre documentos y datos | El texto aprobado y el sistema estructurado divergen | Puerta de reconciliación antes de publicar |

NIST denomina **confabulación** a la generación de contenido erróneo presentado con seguridad y recomienda verificar fuentes y citas, procedencia de datos y resultados de RAG durante pruebas y monitoreo. [NIST AI 600‑1, julio de 2024](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf).

---

## **3\. Comparación de frameworks tradicionales**

### **Clasificación**

| Enfoque | Clasificación | Qué debe conservarse | Adaptación necesaria |
| ----- | ----- | ----- | ----- |
| ISO 15489 | **Vigente** | Evidencia, contexto, controles, responsabilidades, captura y conservación | Considerar datos, afirmaciones y eventos como registros |
| ISO 30301 | **Vigente** | Política, objetivos, supervisión, medición y mejora del sistema de registros | Incorporar gobierno de modelos, prompts y automatizaciones |
| ISO 9001: información documentada | **Vigente** | Documentar lo necesario para operar y demostrar conformidad | Aplicar “documentación mínima suficiente” |
| Records Management | **Adaptable** | Autenticidad, integridad, disponibilidad, retención y disposición | Administrar también registros generados o transformados por IA |
| DMS tradicional | **Insuficiente** como modelo central | Versiones, permisos, búsqueda y archivo | Complementarlo con datos estructurados y procedencia |
| ECM | **Adaptable** | Captura, almacenamiento, flujo, preservación y entrega | Separar contenido, evidencia, registros estructurados y vistas |
| Knowledge Management / ISO 30401 | **Adaptable** | Creación, uso, transferencia y mejora del conocimiento | Añadir autoridad, grounding y estados de confianza |
| Single Source of Truth | **Adaptable** | Definir una autoridad por dominio | Preferir varias fuentes oficiales federadas, no una megabase |
| Docs as Code | **Adaptable** | Versionado, revisión, diff, pruebas y despliegue | Aplicarlo a prompts, esquemas, plantillas y procedimientos críticos |
| ADR y Decision Logs | **Vigente** | Contexto, decisión, consecuencias y estado | Generalizarlo a decisiones comerciales y operativas |
| Gestión de configuración y cambios | **Vigente** | Baselines, cambios autorizados y trazabilidad | Versionar modelos, prompts, esquemas y reglas de RAG |
| Taxonomías y metadatos | **Vigente** | Clasificación, búsqueda, interoperabilidad y retención | Automatizar sugerencias, nunca la autoridad final |
| RACI | **Adaptable** | Responsabilidad por ejecución | No usarlo como sustituto de autoridad decisoria |
| DACI | **Vigente** | Driver, Approver, Contributors, Informed | Recomendado para decisiones operativas |
| RAPID | **Vigente** | Recommend, Agree, Perform, Input, Decide | Reservarlo para decisiones transversales importantes |
| Carpetas y nomenclatura como control principal | **Reemplazable** | La nomenclatura sigue ayudando a las personas | Usar identificadores y metadatos como control real |

ISO 9001 no obliga a mantener un manual o una proliferación de procedimientos: permite flexibilidad y exige conservar la información necesaria para la eficacia del sistema. [Guía oficial de ISO 9001 sobre información documentada](https://www.iso.org/files/live/sites/isoorg/files/archive/pdf/en/documented_information.pdf).

ISO 23081 establece que los principios de metadatos son aplicables a registros, procesos y sistemas, mientras ISO 16175 define requisitos funcionales para cualquier aplicación que administre registros digitales. [ISO 23081-1:2017](https://www.iso.org/standard/73172.html), [ISO 23081-2:2021](https://www.iso.org/standard/81600.html), [ISO 16175-1:2020](https://www.iso.org/standard/74294.html).

### **Qué automatizar**

* Captura de metadatos técnicos.  
* Clasificación inicial.  
* Extracción de decisiones, tareas, riesgos y contradicciones.  
* Comparación de versiones.  
* Generación de vistas narrativas.  
* Alertas de vencimiento.  
* Enrutamiento de aprobaciones.  
* Archivo de borradores bajo reglas.  
* Verificación de campos obligatorios.

### **Qué no automatizar plenamente**

* Determinación de autoridad.  
* Interpretación contractual.  
* Aceptación de alcance o precio.  
* Decisiones laborales.  
* Compromisos externos.  
* Resolución de contradicciones materiales.  
* Eliminación de registros sujetos a obligaciones legales.  
* Declaración de que una inferencia constituye un hecho.

### **Burocracia que debe evitarse**

* Documentar cada conversación.  
* Duplicar información disponible en un sistema oficial.  
* Mantener la misma información en varios archivos.  
* Pedir tres aprobaciones para asuntos de bajo riesgo.  
* Convertir todo chat en minuta.  
* Usar RACI en cada tarea pequeña.  
* Conservar indefinidamente grabaciones y borradores sin justificación.  
* Crear taxonomías con decenas de categorías que nadie puede aplicar consistentemente.

---

## **4\. Estado de los patrones AI‑Native**

### **No existe todavía un framework consolidado**

Al corte de esta investigación, no existe una norma publicada que integre completamente records management, IA generativa, RAG, conocimiento estructurado, agentes, procedencia y documentos dinámicos.

ISO inició el 31 de marzo de 2026 dos trabajos relevantes:

* **ISO/AWI TS 25280-1**, para registros generados o asociados con negocios habilitados por IA.  
* **ISO/AWI TS 25280-2**, para aplicar capacidades de IA a controles y procesos de records management.

Ambos se encuentran en etapa preparatoria 20.00; no deben presentarse como estándares vigentes. [ISO/AWI TS 25280-1](https://www.iso.org/standard/92967.html), [ISO/AWI TS 25280-2](https://www.iso.org/standard/92968.html).

También está en desarrollo ISO/IEC AWI 25590 sobre calidad de resultados de aplicaciones generativas. [ISO/IEC AWI 25590](https://www.iso.org/standard/90832.html).

Por tanto, SofLIA deberá construir un modelo híbrido propio basado en piezas maduras.

| Patrón | Naturaleza | Madurez | Uso recomendado |
| ----- | ----- | ----- | ----- |
| ISO 15489/30301/23081 | Norma formal | Alta | Registros, metadatos, ciclo de vida |
| ISO/IEC 42001 | Norma formal | Alta | Gobierno de sistemas de IA |
| NIST AI RMF y perfil GenAI | Framework público | Alta | Riesgos, evaluación y supervisión |
| W3C PROV | Estándar formal | Alta | Procedencia interoperable |
| RAG | Investigación académica y patrón industrial | Media-alta | Recuperación desde fuentes autorizadas |
| GraphRAG | Investigación y software emergente | Media | Consultas globales y relaciones complejas |
| Knowledge graphs | Tecnología madura | Alta | Entidades, relaciones y procedencia |
| Structured Outputs | Funcionalidad comercial | Media-alta | Conformidad con esquemas |
| Event sourcing | Patrón arquitectónico | Alta | Historial de decisiones y cambios críticos |
| Human-in-the-loop | Práctica aceptada | Alta | Aprobaciones proporcionales al riesgo |
| Context engineering | Práctica emergente | Media | Selección del contexto de agentes |
| Memoria de agentes | Práctica emergente | Baja-media | Personalización, no verdad oficial |
| Documentos dinámicos | Recomendación arquitectónica | Media | Vistas generadas desde registros |
| MCP | Protocolo abierto emergente | Media | Interfaz entre agentes, herramientas y fuentes |

El RAG original combina memoria paramétrica y una fuente externa recuperable, pero su propio trabajo fundador identifica como problemas abiertos la actualización del conocimiento y la procedencia. [Lewis et al., NeurIPS 2020](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html).

GraphRAG mostró mejores resultados que RAG convencional en ciertas preguntas globales sobre grandes corpus, pero eso no demuestra que sea superior para todas las consultas ni justifica implementarlo inicialmente. [Microsoft Research, 2024–2025](https://www.microsoft.com/en-us/research/publication/from-local-to-global-a-graph-rag-approach-to-query-focused-summarization/).

Los Structured Outputs pueden imponer un JSON Schema, pero la conformidad sintáctica no garantiza que el contenido sea verdadero. [Documentación de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

---

## **5\. Modelo operativo recomendado**

### **Las siete capas que deben permanecer separadas**

| Capa | Qué contiene | Regla |
| ----- | ----- | ----- |
| Fuente | CRM, correo, reunión, contrato, sistema, formulario | Tiene autoridad según su dominio |
| Evidencia | Grabación, mensaje, archivo original, transacción | No se modifica; se conserva hash y procedencia |
| Registro estructurado | Decisión, afirmación, tarea, riesgo, aprobación | Unidad principal de conocimiento operativo |
| Contenido narrativo | Explicación, contexto, razones, procedimiento | Puede ser redactado o resumido |
| Documento | Alcance, minuta, propuesta, reporte | Vista editable o snapshot oficial |
| Plataforma | Docs, SharePoint, Notion, CRM, base de datos | Sustituible mediante adaptadores |
| Índice derivado | Búsqueda, embeddings, RAG, GraphRAG | Nunca es fuente oficial |

### **Qué conservar en cada forma**

| Información | Forma recomendada |
| ----- | ----- |
| Decisión, estado, responsable, fecha, autoridad | Datos estructurados |
| Relato, explicación, procedimiento, justificación | Texto narrativo |
| Grabación, contrato firmado, correo original | Evidencia inmutable |
| Borrador colaborativo | Documento editable |
| Versión aprobada | Snapshot bloqueado más hash |
| Resumen ejecutivo o minuta visible | Vista dinámica generada |
| Embeddings y resúmenes para IA | Índice derivado y reconstruible |
| Cambios de estado y aprobaciones | Registro append-only de eventos |

### **Principio de fuentes oficiales federadas**

No conviene obligar a que una sola plataforma sea autoridad de todo:

* CRM: cliente, contacto, oportunidad y etapa comercial.  
* Sistema de proyectos: tareas, entregables e hitos.  
* Base estructurada SDO‑AN: decisiones, afirmaciones, autoridad, vigencia y relaciones.  
* Repositorio documental: evidencias y snapshots.  
* Sistema financiero: facturación y pagos.  
* Sistema de identidad: usuarios, grupos y permisos.

El SDO‑AN no duplica indiscriminadamente. Conserva identificadores, relaciones y una vista consolidada.

---

## **6\. Arquitectura conceptual**

```
flowchart TB
    A["Fuentes empresariales"] --> B["Captura y normalización"]
    B --> C["Repositorio de evidencia"]
    B --> D["Registro estructurado"]
    C --> E["RAG autorizado y generación"]
    D --> E
    E --> F["Edición colaborativa"]
    F --> G["Reconciliación y aprobación"]
    G --> D
    G --> H["Snapshot oficial"]
    D --> I["Búsqueda, agentes y APIs"]
    H --> I
    J["Gobierno, permisos, retención y auditoría"] -.-> B
    J -.-> E
    J -.-> G
    J -.-> I
```

### **Componentes**

1. **Fuentes:** reuniones, correo, chats, formularios, CRM, contratos, archivos y sistemas.  
2. **Captura:** conectores, APIs, webhooks, MCP o carga humana.  
3. **Normalización:** identidad, fechas, entidades, duplicados, clasificación y localizadores.  
4. **Evidencia:** original, checksum, fecha de captura, custodio y permisos.  
5. **Registro estructurado:** Postgres u otra tecnología portable.  
6. **Recuperación:** búsqueda léxica, vectorial y por relaciones, filtrada por permisos.  
7. **Generación:** esquemas de salida, citas, modelo y prompt versionados.  
8. **Edición:** Google Docs, Word, Notion o Confluence.  
9. **Reconciliación:** cualquier cambio humano relevante vuelve al registro estructurado.  
10. **Aprobación:** el aprobador autorizado convierte la propuesta en vigente.  
11. **Snapshot:** PDF, DOCX, Markdown o JSON con hash y vínculos a los registros.  
12. **Consulta:** agentes, dashboards y documentos dinámicos.

### **Uso de event sourcing**

No recomiendo event sourcing completo para todo el contenido. Su complejidad solamente se justifica en áreas donde la reconstrucción histórica y auditoría sean esenciales. Microsoft advierte que el patrón introduce costos y restricciones arquitectónicas. [Azure Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing).

Debe utilizarse solamente para eventos como:

* decisión propuesta;  
* aprobación;  
* rechazo;  
* cambio de alcance;  
* sustitución;  
* vencimiento;  
* cambio de permisos;  
* publicación;  
* archivo;  
* eliminación autorizada.

---

## **7\. Taxonomía y modelo mínimo de datos**

### **Taxonomía documental**

| Código | Familia | Ejemplos |
| ----- | ----- | ----- |
| GOV | Gobierno | políticas, reglas, delegaciones |
| DEC | Decisiones | decision records, aprobaciones |
| AUT | Autoridad | RACI, DACI, roles, poderes |
| PRC | Procesos | procedimientos, playbooks |
| MTG | Reuniones | agendas, minutas, transcripciones |
| COM | Comercial | alcances, propuestas, cotizaciones |
| CTR | Contractual | contratos, NDA, anexos |
| PRJ | Proyecto | planes, entregables, riesgos |
| REP | Reportes | avances, resultados, indicadores |
| KNO | Conocimiento | guías, investigación, referencias |
| EVD | Evidencia | grabaciones, mensajes, originales |
| AIA | Activos de IA | prompts, modelos, esquemas, evals |

### **Entidades principales**

| Entidad | Campos mínimos |
| ----- | ----- |
| `Source` | ID, sistema, URI, tipo, propietario, fecha, clasificación |
| `Evidence` | ID, source\_id, archivo original, hash, fecha de captura, localizador, custodio |
| `Claim` | ID, afirmación, tipo, sujeto, objeto, estados, fuentes y vigencia |
| `Decision` | ID, pregunta, opciones, decisión, contexto, aprobador, fecha, consecuencias |
| `Action` | ID, descripción, responsable, origen, vencimiento, estado |
| `Responsibility` | persona/rol, actividad, tipo RACI, vigencia |
| `Risk` | descripción, probabilidad, impacto, propietario, tratamiento |
| `Approval` | objeto, aprobador, autoridad, resultado, fecha, comentario |
| `Artifact` | tipo, plantilla, claim\_ids incluidos, URI, hash, versión |
| `GenerationRun` | modelo, versión, prompt, contexto, esquema, resultado, evaluación |
| `AuditEvent` | actor, evento, antes, después, fecha, razón |
| `RetentionRule` | categoría, disparador, plazo, disposición, excepción |

### **Campos críticos de una afirmación**

```
claim_id:
claim_type: fact | decision | commitment | requirement | risk | proposal
statement:
subject_id:
object_ids: []
source_refs:
  - evidence_id:
    locator: "página, celda, minuto o mensaje"
epistemic_status:
authority_status:
temporal_status:
valid_from:
valid_until:
review_due:
owner:
reviewer:
approver:
authority_basis:
confidentiality:
supersedes:
extracted_by: human | ai
model_version:
prompt_version:
confidence:
created_at:
updated_at:
```

**`confidence` expresa confianza de extracción, no nivel de verdad ni autoridad.**

La procedencia puede modelarse siguiendo la separación de W3C PROV entre entidades, actividades y agentes. [W3C PROV‑O](https://www.w3.org/TR/prov-o/), [W3C PROV Overview](https://www.w3.org/TR/prov-overview/).

---

## **8\. Estados, ciclo de vida y vigencia**

### **No utilizar un solo campo “estado”**

Una afirmación necesita tres dimensiones independientes:

| Dimensión | Valores |
| ----- | ----- |
| Epistemológica | observado, corroborado, inferido, disputado, desconocido |
| Autoridad | borrador, propuesto, pendiente de aprobación, aprobado, rechazado |
| Temporal | futuro, vigente, reemplazado, vencido, archivado |

De esta manera:

* **Confirmado:** corroborado por evidencia suficiente.  
* **Inferido:** conclusión razonable, no evidencia directa.  
* **Propuesto:** opción presentada, todavía sin aprobación.  
* **Pendiente:** espera decisión de una autoridad identificada.  
* **Vigente:** aprobado y dentro de su periodo de validez.  
* **Reemplazado:** existe un sucesor explícito.  
* **Vencido:** superó su fecha o condición de vigencia.  
* **Archivado:** ya no opera, pero se conserva como evidencia.

### **Ciclo de vida**

```
stateDiagram-v2
    [*] --> Capturado
    Capturado --> Extraido
    Extraido --> Validado
    Validado --> Propuesto
    Propuesto --> Pendiente
    Pendiente --> Vigente: aprobación
    Pendiente --> Rechazado
    Vigente --> EnRevision
    EnRevision --> Vigente
    EnRevision --> Reemplazado
    Vigente --> Vencido
    Reemplazado --> Archivado
    Vencido --> Archivado
    Archivado --> Eliminado: regla autorizada
```

### **Reglas**

1. La fecha más reciente no prevalece automáticamente.  
2. Una edición no sustituye una aprobación.  
3. El silencio nunca equivale a aprobación, salvo regla contractual explícita.  
4. Una minuta no convierte una conversación en decisión.  
5. Una afirmación sin fuente debe marcarse como inferida o desconocida.  
6. Todo registro vigente tiene propietario y fecha de revisión.  
7. Toda sustitución enlaza al registro anterior.  
8. Una eliminación conserva un evento de disposición.  
9. Un legal hold suspende la eliminación.  
10. Los índices RAG se reconstruyen al cambiar permisos, fuentes o vigencia.

### **Retención inicial recomendada**

Estos plazos son política de arranque, no dictamen legal; deben validarse contractualmente y con asesoría aplicable.

| Categoría | Retención propuesta |
| ----- | ----- |
| Grabaciones de reuniones | 90–180 días después de aprobar la minuta |
| Transcripciones verificadas | 12 meses o hasta cierre del proyecto |
| Borradores | 90 días después de publicar la versión oficial |
| Decisiones, cambios y aprobaciones | Vigencia más 5 años |
| Alcances y responsabilidades | Vigencia más 5 años |
| Procedimientos | Vigencia más 3 años |
| Propuestas no contratadas | 2 años |
| Contratos, expedientes laborales y financieros | Matriz legal específica |
| Ejecuciones de IA de bajo riesgo | 90 días |
| Ejecuciones de IA que afecten registros | 12–24 meses |
| Bitácoras de publicación, disposición y acceso | 5 años |

---

## **9\. Confidencialidad, responsabilidad y autoridad**

### **Niveles de confidencialidad**

| Nivel | Alcance | Controles |
| ----- | ----- | ----- |
| P0 Público | Publicable sin restricción | Integridad y aprobación editorial |
| P1 Interno | Operación ordinaria | Acceso de personal autorizado |
| P2 Confidencial | Clientes, proyectos, propiedad intelectual | Grupos, no enlaces públicos, DLP |
| P3 Restringido | Laboral, financiero, contractual sensible, credenciales | Need-to-know, MFA, logs, sin RAG general |

El resultado generado debe heredar el nivel más alto de las fuentes utilizadas.

### **Roles del sistema**

| Rol | Responsabilidad |
| ----- | ----- |
| Propietario del conocimiento | Exactitud, vigencia y revisión |
| Autor | Producción del contenido; puede ser humano o IA |
| Revisor | Exactitud técnica y suficiencia de fuentes |
| Aprobador | Convierte una propuesta en oficial |
| Decision Owner | Tiene autoridad para decidir el asunto |
| Steward documental | Taxonomía, metadatos, retención y calidad |
| Custodio técnico | Plataformas, respaldos, permisos y logs |
| Audiencia | Personas autorizadas para consultar o recibir |
| Sistema de IA | Extrae, compara, propone y alerta; nunca decide autoridad |

### **Modelo recomendado**

* **RACI:** ejecución de procesos y entregables.  
* **DACI:** decisión operativa normal.  
* **RAPID:** decisión estratégica o transversal.  
* **Un solo Approver/Decide por decisión.**  
* La IA nunca puede ocupar `A`, `Approver` o `Decide`.

DACI separa Driver, Approver, Contributors e Informed. [Atlassian DACI](https://www.atlassian.com/team-playbook/plays/daci). RAPID separa Recommend, Agree, Perform, Input y Decide. [Bain RAPID](https://www.bain.com/insights/rapid-decision-making/).

---

## **10\. Protocolos operativos**

### **Protocolo para reuniones**

#### **Antes**

* Crear IDs de las decisiones esperadas.  
* Formular la pregunta que debe resolverse.  
* Identificar al Decision Owner.  
* Adjuntar antecedentes vigentes.  
* Diferenciar puntos informativos, de discusión y de decisión.

#### **Durante**

* Marcar explícitamente: hecho, propuesta, decisión, compromiso o pendiente.  
* Registrar quién afirma algo y con qué autoridad.  
* No inferir aprobación por presencia o falta de objeciones.  
* Indicar las restricciones de comunicación externa.

#### **Después**

1. La IA extrae decisiones, tareas, riesgos y afirmaciones con localizadores de tiempo.  
2. El organizador verifica atribuciones y contexto.  
3. Los responsables confirman tareas.  
4. El Decision Owner aprueba únicamente las decisiones.  
5. Se actualiza el registro estructurado.  
6. Se genera la minuta definitiva como vista.  
7. Se notifican solamente las diferencias relevantes.

### **Protocolo ante información faltante**

El agente debe responder en cinco bloques:

1. **Confirmado:** qué está sustentado.  
2. **No confirmado:** qué se menciona, pero carece de autoridad o evidencia.  
3. **Contradicciones:** fuentes incompatibles.  
4. **Pendiente:** qué decisión se requiere y de quién.  
5. **Restricción:** qué no debe comunicarse ni ejecutarse.

Reglas:

* Desconocido no significa falso.  
* Ausencia de evidencia no significa rechazo.  
* Un texto generado no completa datos faltantes.  
* Ante conflicto material, se suspende la publicación externa.  
* La decisión se escala a la autoridad del dominio.  
* La resolución debe crear un registro que sustituya expresamente las versiones anteriores.

---

## **11\. Generación de artefactos mediante IA**

| Artefacto | Fuentes y mínimos | Máx. autonomía | Revisión/autoridad | Vigencia y destino | Riesgo principal |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Alcance | Propuesta, decisiones, contrato; entregables, exclusiones, precio, fechas | 2 | Comercial \+ entrega; aprueba SofLIA y cliente | Hasta cambio aprobado; snapshot contractual | Compromiso no autorizado |
| Agenda | Calendario, pendientes, decisiones abiertas | 4 | Organizador | Hasta la reunión | Omitir autoridad |
| Minuta | Grabación, transcripción, asistentes | 3 | Chair verifica; Decision Owner aprueba decisiones | Registro del proyecto | Falsa atribución |
| Decision record | Fuentes, opciones, decisión, consecuencias | 2–3 | Decision Owner | Hasta sustitución | Convertir propuesta en decisión |
| Matriz RACI | Procesos, roles y alcance | 2 | Process Owner | Hasta cambio de rol/proceso | Asignación sin consentimiento |
| Procedimiento | Política, sistema, expertos y controles | 3 | Dueño del proceso | Revisión trimestral/semestral | Instrucción obsoleta |
| Reporte | Sistemas oficiales y periodo | 3 | Responsable del indicador | Periodo reportado | Cifras inconsistentes |
| Propuesta | CRM, diagnóstico, catálogo, precios aprobados | 2 | Comercial y dirección | Hasta vencimiento | Precio o promesa incorrecta |
| Solicitud de aprobación | Objeto, riesgos, fuentes y recomendación | 4 | Aprobador humano | Hasta resolución | Aprobación ambigua |
| Comunicación | Registro aprobado y audiencia | 2 externa; 4 interna rutinaria | Dueño del mensaje | Según evento | Compromiso frente a terceros |
| Comparación de versiones | Dos versiones identificadas y baselines | 4 | Revisión si el cambio es material | Registro de cambio | Omitir cambio semántico |
| Alerta de contradicción | Claims, fuentes, fechas y autoridad | 4 | Steward/Decision Owner | Hasta resolución | Falso positivo |
| Lista de pendientes | Decisiones y minutas aprobadas | 3 | Responsable confirma | Hasta cierre | Crear tareas inexistentes |

### **Escala de autonomía**

| Nivel | Uso recomendado |
| ----- | ----- |
| 0 | Localizar fuentes |
| 1 | Resumir y relacionar con citas |
| 2 | Proponer borradores, metadatos y clasificaciones |
| 3 | Actualizar estado pendiente con revisión obligatoria |
| 4 | Publicar o archivar asuntos de bajo riesgo bajo reglas deterministas |
| 5 | Ejecutar tareas documentales autónomas, acotadas, reversibles y auditadas |

Nivel 5 puede utilizarse para reindexar, regenerar vistas, detectar vencimientos o mover borradores. No para decisiones estratégicas, laborales, financieras, contractuales ni compromisos con terceros.

---

## **12\. Modelo de trazabilidad**

Cada salida generativa relevante debe responder:

* Qué modelo y versión la produjo.  
* Qué prompt, plantilla y esquema utilizó.  
* Qué fuentes fueron recuperadas.  
* Qué fragmentos sustentan cada afirmación.  
* Qué permisos tenía el agente.  
* Qué validaciones pasaron o fallaron.  
* Quién revisó.  
* Quién aprobó.  
* Qué versión oficial resultó.  
* Qué registros fueron creados, modificados o sustituidos.

Los prompts de producción deben administrarse como código: revisión, pruebas y versionado. La documentación actual de OpenAI recomienda conservarlos en código y fijar snapshots de modelos junto con suites de evaluación. [Guía de prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering).

MCP debe ser una interfaz de herramientas y recursos, no una fuente de verdad ni un mecanismo de autorización autónomo. Su arquitectura define recursos, prompts y herramientas sobre una capa cliente-servidor; los controles de consentimiento y autorización corresponden a la implementación. [Arquitectura MCP](https://modelcontextprotocol.io/docs/learn/architecture), [prácticas de seguridad MCP](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).

---

## **13\. Matriz de riesgos y controles**

| Riesgo | Control preventivo | Control detectivo/correctivo |
| ----- | ----- | ----- |
| Alucinación o confabulación | RAG autorizado, esquema, prohibición de completar faltantes | Verificación de citas y muestreo |
| Fuente obsoleta | Filtrar por vigencia y `supersedes` | Alertas de revisión y stale-rate |
| Contradicciones | Conservar claims separados; no fusionar automáticamente | Caso de conflicto y resolución autorizada |
| Pérdida de procedencia | IDs, localizadores, hash, W3C PROV | Auditoría de respuestas sin fuente |
| Filtración de datos | ACL-aware retrieval, clasificación heredada | DLP, logs y alertas de exportación |
| Accesos excesivos | Mínimo privilegio y herramientas por tarea | Revisión trimestral de permisos |
| Prompt injection | Separar instrucciones de datos, sanitizar fuentes y limitar herramientas | Pruebas adversariales y kill switch |
| Compromiso no autorizado | Separar generación de publicación | Aprobación humana y registro de autoridad |
| Dependencia del proveedor | Formatos abiertos, exportaciones y adaptadores | Prueba semestral de portabilidad |
| Automatización de errores | Idempotencia, validaciones, dry-run y rollback | Cola de excepciones e incidentes |
| Cambio de modelo o prompt | Versiones fijadas y evals antes de desplegar | Comparación contra conjunto dorado |
| Eliminación indebida | Retention schedule y legal hold | Disposition review y log de eliminación |
| Memoria contaminada | Memoria derivada, separada del registro oficial | Reconstrucción y purga controlada |

OWASP identifica prompt injection, revelación de información sensible y agencia excesiva como riesgos principales de aplicaciones con LLM. [OWASP GenAI Top 10](https://genai.owasp.org/llm-top-10/), [Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).

NIST señala que los niveles de revisión humana deben variar según el contexto y riesgo. [NIST AI 600‑1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf). ISO/IEC 42001 proporciona la capa de sistema de gestión para desarrollar o utilizar IA responsablemente. [ISO/IEC 42001:2023](https://www.iso.org/standard/42001).

---

## **14\. Evaluación de plataformas**

| Plataforma | Fortaleza | Limitación como núcleo SDO‑AN | Papel recomendado |
| ----- | ----- | ----- | ----- |
| Google Workspace | Colaboración, Drive, Docs, APIs, etiquetas, Vault | Modelo centrado en archivos; trazabilidad estructurada limitada | Superficie de trabajo y repositorio |
| Microsoft 365/SharePoint/Purview | Metadatos, content types, versiones, records y retención | Mayor complejidad administrativa | Alternativa fuerte para gobierno corporativo |
| Notion | Bases ligeras, propiedades y vistas | Records management y retención limitados | Wiki y portal operativo |
| Confluence | Documentación, páginas, historial y Jira | Menor capacidad transaccional y de retención formal | Conocimiento técnico y de proyectos |
| DMS | Control documental especializado | No modela bien conocimiento atómico | Documentos formales y evidencia |
| ECM | Ciclo de vida empresarial | Costo y complejidad | Organizaciones reguladas o de gran escala |
| Base relacional | Integridad, esquema, consultas, portabilidad | No es buena superficie narrativa | Registro operativo principal |
| Knowledge graph | Relaciones, contexto y procedencia | Complejidad y costo de mantenimiento | Capa posterior para consultas complejas |
| Vector DB/RAG | Recuperación semántica | Derivado, probabilístico, sensible a permisos | Índice reconstruible |
| APIs | Acceso transaccional controlado | Integración específica | Interfaz oficial entre sistemas |
| MCP | Acceso estandarizado para agentes | No reemplaza API, permisos ni auditoría | Adaptador de agentes |
| Sistema propio | Control de modelo, reglas y portabilidad | Requiere mantenimiento | Núcleo mínimo del SDO‑AN |
| Híbrido | Equilibra experiencia y gobierno | Requiere arquitectura e IDs comunes | **Opción recomendada** |

### **Google Docs: qué debe hacer**

* Redacción humana.  
* Coedición y comentarios.  
* Sugerencias y revisión.  
* Presentación narrativa.  
* Aprobación de una versión.  
* Generación de PDFs o DOCX.  
* Vista de registros estructurados.  
* Colaboración con clientes.

### **Qué no debe hacer**

* Ser la única fuente de decisiones, tareas o autoridad.  
* Guardar el único historial de aprobaciones.  
* Ser memoria oficial de agentes.  
* Resolver contradicciones.  
* Administrar por sí solo retención y disposición.  
* Conservar el único registro de modelos y prompts.  
* Sustituir la base de datos operativa.  
* Determinar qué afirmaciones son oficiales.

Google Drive dispone de etiquetas con campos estructurados, controles de permisos, aprobaciones y retención mediante Vault. [Etiquetas de clasificación](https://support.google.com/a/answer/9292382), [retención de Drive en Vault](https://support.google.com/vault/answer/7657465).

Sin embargo:

* Un editor puede desbloquear un archivo aprobado y volver a editarlo.  
* El comportamiento de reinicio de aprobaciones depende de la configuración.  
* La lista de revisiones obtenida mediante API puede ser incompleta para documentos con muchas ediciones.  
* Por ello, la aprobación oficial debe registrar también revision ID, hash, aprobador y snapshot en el SDO‑AN. [Aprobaciones de Drive](https://support.google.com/drive/answer/9387535), [limitaciones de revisiones mediante API](https://developers.google.com/workspace/drive/api/guides/manage-revisions).

Google permite exportar documentos a DOCX, ODT, RTF, PDF, texto, HTML, EPUB y Markdown, lo que favorece la portabilidad del contenido, aunque no necesariamente de todo el historial, comentarios, permisos y metadatos. [Formatos oficiales de exportación](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).

### **Recomendación tecnológica concreta para SofLIA**

* **Google Shared Drives:** archivos, evidencia y colaboración.  
* **Google Docs:** edición y aprobación humana.  
* **Supabase/Postgres:** registro estructurado SDO‑AN.  
* **Almacenamiento versionado:** evidencias y snapshots con hash.  
* **HubSpot:** fuente oficial del dominio comercial.  
* **Git:** prompts, esquemas, plantillas y evaluaciones.  
* **RAG con filtrado por ACL:** consulta de fuentes autorizadas.  
* **MCP/API propia:** acceso controlado desde ChatGPT y agentes.  
* **Knowledge graph:** posponer hasta demostrar consultas relacionales que Postgres no resuelva razonablemente.

---

## **15\. Caso completo de Charly**

### **Por qué varios documentos no resolvieron la incertidumbre**

Porque probablemente contenían partes distintas del problema:

* El alcance describe actividades, pero no necesariamente la continuidad.  
* La agenda anuncia temas, pero no decisiones.  
* La minuta puede registrar opiniones, pero no autoridad.  
* Una conversación puede sugerir una colaboración futura sin aprobarla.  
* Ningún documento responde simultáneamente: qué, quién, con qué autoridad, desde cuándo, hasta cuándo y qué se puede comunicar.

### **Registro estructurado ilustrativo**

Debe sustituirse con los IDs y fechas reales de las fuentes.

| Elemento | Estado | Evidencia | Autoridad | Próxima acción | Comunicación |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Participación de Charly en actividades del alcance vigente | Corroborado \+ aprobado \+ vigente, **si existe alcance aprobado** | Alcance `SCP-001`, versión y aprobación | Aprobador del alcance | Verificar entregables y fechas | Puede comunicarse |
| Incorporación permanente | Desconocido \+ pendiente | No existe decisión formal localizada | Ernesto | Decidir modalidad | No comunicar como confirmada |
| Cambio de modalidad contractual | Propuesto o desconocido | Conversaciones/minutas | Ernesto y, si aplica, validación contractual | Crear decisión `DEC-CHARLY-002` | Restringido |
| Actividades inmediatas | Incompleto si no existe task register | Alcance y última minuta | Project Owner | Crear tareas, responsable y fecha | Comunicar únicamente las aprobadas |
| Continuidad posterior al alcance | Pendiente | No hay decisión vigente | Ernesto | Fijar fecha límite de decisión | No prometer continuidad |

### **Respuesta que el sistema podría generar**

Al corte del **\[fecha\]**, está aprobada la participación de Charly únicamente en las actividades incluidas en el alcance **\[ID y versión\]**, aprobado por **\[autoridad\]** el **\[fecha\]**.

No se ha localizado una decisión formal que apruebe una incorporación permanente, un cambio de modalidad o la continuidad posterior a ese alcance. Estos asuntos permanecen pendientes de decisión por Ernesto.

Hasta que exista una aprobación registrada, no deben comunicarse como confirmados ni convertirse en compromisos, tareas adicionales o condiciones de colaboración. La siguiente acción es resolver la decisión **DEC‑CHARLY‑002** antes del **\[fecha\]**.

### **Respuesta si el alcance tampoco está formalmente aprobado**

Se localizó un documento de alcance que describe posibles actividades para Charly, pero no se encontró evidencia suficiente de su aprobación o vigencia. Por tanto, su contenido debe tratarse como propuesto y pendiente de validación, no como una asignación confirmada.

### **Ficha visible del caso**

```
subject: Charly
current_decision:
  approved: "Participación limitada al alcance vigente [ID]"
  not_decided:
    - "Incorporación permanente"
    - "Modalidad futura"
decision_owner: Ernesto
sources:
  - scope_id:
  - minutes_ids: []
last_verified_at:
confidence: "alta | media | baja"
next_action:
due_date:
communication_restriction:
  - "No afirmar continuidad permanente"
  - "No asignar actividades fuera del alcance"
```

---

## **16\. Plantillas esenciales**

### **A. Registro de decisión**

```
decision_id:
question:
status: proposed | pending | approved | rejected | superseded
context:
options:
recommendation:
decision:
decision_owner:
authority_basis:
contributors:
sources:
consequences:
valid_from:
review_due:
supersedes:
communication_rule:
approved_at:
```

### **B. Registro de responsabilidad**

```
responsibility_id:
activity:
deliverable:
responsible:
accountable:
consulted:
informed:
source_scope:
start_date:
end_date:
acceptance_criteria:
status:
```

### **C. Minuta estructurada**

```
meeting_id:
date:
purpose:
attendees:
decision_owner_by_topic:
confirmed_facts:
decisions:
proposals:
actions:
risks:
contradictions:
unknowns:
communication_restrictions:
source_recording:
reviewed_by:
approved_decisions_by:
```

### **D. Solicitud de aprobación**

```
approval_request_id:
object_type:
object_id:
decision_required:
recommended_option:
alternatives:
evidence:
risks:
financial_or_external_commitment:
approver:
deadline:
outcome:
```

### **E. Registro de cambio**

```
change_id:
object_id:
baseline_version:
proposed_change:
reason:
impact:
affected_claims:
affected_documents:
requested_by:
reviewed_by:
approved_by:
effective_date:
rollback_plan:
```

### **F. Tarjeta de contexto vigente**

Debe mostrar solamente:

* Qué está vigente.  
* Qué cambió.  
* Qué está pendiente.  
* Quién decide.  
* Próxima acción.  
* Riesgos.  
* Restricciones de comunicación.  
* Fecha de verificación.  
* Enlaces a evidencias.

---

## **17\. Plan de implementación 30/60/90 días**

### **Días 1–30: gobierno mínimo y piloto manual**

* Nombrar propietario del SDO‑AN y steward.  
* Seleccionar dos casos: Charly y un proyecto comercial activo.  
* Inventariar fuentes oficiales por dominio.  
* Aprobar taxonomía, estados y niveles de confidencialidad.  
* Implementar tablas de decisiones, claims, acciones, fuentes y aprobaciones.  
* Crear las seis plantillas esenciales.  
* Configurar Shared Drive y permisos.  
* Definir 10 consultas que el sistema debe responder.  
* Operar en niveles de autonomía 0–2.  
* Crear un conjunto de evaluación con casos correctos y contradictorios.

**Salida:** registro funcional, aunque parcialmente manual.

### **Días 31–60: captura y generación asistida**

* Conectar reuniones, Drive, CRM y correo autorizado.  
* Extraer decisiones y tareas mediante outputs estructurados.  
* Añadir citas y localizadores.  
* Implementar reconciliación entre Docs y Postgres.  
* Generar minutas, tarjetas de contexto y reportes.  
* Activar alertas de vigencia y contradicción.  
* Versionar prompts, esquemas y modelos.  
* Probar ACL-aware RAG.  
* Operar en niveles 2–3.

**Puerta de avance:** precisión de extracción suficiente, cero publicaciones no autorizadas y auditoría completa.

### **Días 61–90: automatización acotada**

* Automatizar agenda, clasificación, actualización de pendientes y archivo de borradores.  
* Introducir nivel 4 únicamente para procesos de bajo riesgo.  
* Exponer consultas mediante API/MCP.  
* Implementar dashboards de calidad documental.  
* Probar exportación completa a formatos abiertos.  
* Ejecutar pruebas de prompt injection y accesos.  
* Revisar retención y disposición.  
* Auditar el caso Charly desde evidencia hasta respuesta final.  
* Decidir si GraphRAG aporta valor real.

**Nivel 5:** limitado a tareas reversibles de mantenimiento.

---

## **18\. Indicadores de efectividad**

| Indicador | Objetivo inicial a 90 días |
| ----- | ----- |
| Tiempo para localizar la versión vigente | Menos de 2 minutos |
| Decisiones con fuente, autoridad y fecha | ≥95% |
| Afirmaciones operativas con cita verificable | ≥95% |
| Registros vigentes con propietario y revisión | ≥90% |
| Pendientes sin responsable | \<5% |
| Registros vencidos mostrados como vigentes | \<2% |
| Precisión de extracción de decisiones | ≥95% |
| Recall de decisiones materiales | ≥90% |
| Publicaciones o compromisos no autorizados | 0 |
| Contradicciones detectadas antes de publicación | ≥90% |
| Tiempo entre reunión y minuta verificada | \<24 horas |
| Tiempo entre aprobación y actualización del sistema | \<4 horas |
| Porcentaje de documentos generados desde registros | ≥60% |
| Horas humanas dedicadas a formateo | Reducción ≥40% |
| Tasa de respuestas “no sé/no hay evidencia” correctas | Medida y premiada |
| Portabilidad | Exportación reconstruible semestral exitosa |

No debe medirse el éxito por cantidad de documentos creados. Las métricas principales deben ser tiempo para encontrar la respuesta oficial, porcentaje de decisiones trazables y reducción de ambigüedad.

---

# **Recomendación final priorizada**

## **Prioridad 1: crear el registro operativo estructurado**

Empezar con cinco entidades: fuentes, afirmaciones, decisiones, acciones y aprobaciones. Esto resolverá más ambigüedad que reorganizar todas las carpetas.

## **Prioridad 2: separar tres tipos de estado**

Epistemológico, autoridad y vigencia. Esta es la defensa principal contra tratar como verdadero todo lo que aparece escrito.

## **Prioridad 3: aplicar “documentación por excepción material”**

Debe documentarse cuando:

* compromete a SofLIA o a terceros;  
* modifica alcance, presupuesto, fechas, roles o derechos;  
* será reutilizado o cuestionado;  
* produce un riesgo significativo;  
* requiere evidencia;  
* o el costo de perder el conocimiento supera el costo de capturarlo.

## **Prioridad 4: mantener Google Docs como superficie, no como cerebro**

Docs debe ofrecer la mejor experiencia de colaboración. El registro estructurado, la evidencia y la auditoría deben existir fuera de él.

## **Prioridad 5: introducir IA gradualmente**

* Nivel 0–2 desde el piloto.  
* Nivel 3 después de evaluación.  
* Nivel 4 únicamente con reglas, permisos y rollback.  
* Nivel 5 solamente para mantenimiento reversible.  
* Nunca automatizar la formalización de decisiones materiales.

## **Prioridad 6: evitar construir demasiado pronto**

No comenzar con un ECM completo, un knowledge graph empresarial ni event sourcing integral. Para SofLIA, la primera arquitectura viable es:

**Google Workspace \+ Supabase/Postgres \+ evidencia versionada \+ RAG autorizado \+ prompts en Git \+ API/MCP controlado.**

Este modelo equilibra los tres riesgos centrales:

* **Subdocumentación:** obliga a registrar decisiones, responsabilidades y compromisos materiales.  
* **Sobredocumentación:** evita crear archivos cuando basta un registro estructurado.  
* **Automatización sin gobierno:** separa generación, revisión, autoridad, publicación y ejecución.

