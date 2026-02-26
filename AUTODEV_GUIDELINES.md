# 🤖 SofLIA Hub — AutoDev Operating Guidelines (Q&A)

Este documento detalla el marco operativo, técnico y de seguridad del motor de auto-programación autónoma (**AutoDev**) de SofLIA-HUB, respondiendo punto por punto a los requerimientos de gobernanza y arquitectura.

---

## 1. Objetivo y requerimientos (funcionales / no funcionales)

1.  **¿Cómo capturas el criterio de aceptación?**
    Se capturan mediante el sistema de **Self-Learning**. Las entradas provienen de `AUTODEV_FEEDBACK.md` (sugerencias del usuario) y `AUTODEV_ISSUES.md` (fallas detectadas). El criterio se inyecta en el `RESEARCH_GROUNDING_PROMPT` para que la búsqueda inicial esté alineada con el feedback.
2.  **¿Qué NFRs consideras siempre?**
    Rendimiento (vía mejores prácticas en prompts), Seguridad (escaneo de CVEs en `SecurityAgent`) y Costo (mediante el `OptimalModelRouter` que balancea entre Pro y Flash).
3.  **¿Qué haces cuando el requerimiento está ambiguo?**
    El `AnalyzerAgent` utiliza `web_search` para investigar cómo se resuelve el problema en proyectos de referencia (OpenClaw/Cursor). La decisión se documenta automáticamente en el `README.md` de arquitectura o en el resumen del PR.
4.  **¿Qué define “éxito” para ti?**
    El éxito técnico es un **PR creado con Build Pass** (`npm run build`). El éxito operativo es la notificación de WhatsApp confirmando que la nueva funcionalidad está desplegada en el branch de trabajo.
5.  **¿Cuál es el alcance del sistema?**
    SofLIA no es solo un sistema de auto-programación. Es un **Sistema Operativo de IA** completo que incluye:
    - **Computer Use**: automatización visual, mover archivos, controlar apps, gestionar ventanas
    - **WhatsApp como Centro de Control**: el usuario controla todo SofLIA desde WhatsApp (no solo recibe notificaciones)
    - **Gestión de Sistema**: monitoreo de CPU/RAM/disco, backup automático, limpieza, alertas
    - **Automatización de Consola**: ejecución de scripts, pipelines, tareas programadas
    - **AutoDev**: auto-programación con implementaciones ambiciosas (mínimo 500 líneas por run)

---

## 2. Contexto de repo y arquitectura

1.  **¿Cuál es tu regla para elegir qué módulos incluir?**
    Se incluyen módulos `core` (servicios, lógica de negocio) y se excluyen los `edge` o efímeros (`node_modules`, `dist`, logs). El límite está definido por un presupuesto de **100k caracteres** de contexto útil.
2.  **¿Cómo representas el mapa del sistema?**
    A través de una lista jerárquica de archivos detectados por `readProjectFiles` y la lectura del `package.json` para mapear el grafo de dependencias.
3.  **¿Qué convenciones internas deben ir siempre en el contexto?**
    Indentación de 2 espacios, tipado estricto en TypeScript, la **regla absoluta de no realizar Major Version Bumps** en dependencias, y la **priorización de funcionalidades de sistema completo** (Computer Use, WhatsApp Control, Gestión de Sistema) sobre mejoras incrementales de código.
4.  **¿Qué señales te dicen “me falta contexto” antes de correr el modelo?**
    Cuando el `DeepResearcher` no encuentra definiciones de interfaces o tipos en los archivos cargados (triggers de error TS2304/TS2339), lo que dispara una llamada a `read_file` para traer archivos adicionales.

---

## 3. Manejo de archivos y evidencia

1.  **¿Tienes un “Context Pack” estándar?**
    Sí. Para desarrollo es `[package.json + core services + active files]`. Para fixes es `[broken files + error logs + previous diffs]`.
2.  **¿Cómo limitas tokens sin perder lo importante?**
    Usamos **Top-N archivos** (máximo 8 en fixes) y truncamos archivos largos a los primeros 15,000 caracteres, priorizando las definiciones de interfaces.
3.  **¿Cómo adjuntas errores?**
    Mediante `parseBuildErrors`, que extrae un objeto estructurado: `file, line, code, message`. Esto elimina el ruido de los logs crudos.
4.  **¿Qué formato usas para no confundir versiones?**
    Usamos **Rutas Relativas** consistentes y el contenido actual del archivo cargado en memoria justo antes de la edición, evitando el uso de hashes innecesarios.

---

## 4. Calidad y validación

1.  **¿Qué suite de validación es obligatoria antes de abrir PR?**
    Mandatoriamente `npm run build` (que incluye lint y typecheck según la config de Vite).
2.  **¿Cuál es tu estrategia de tests?**
    Se delega al `TesterAgent` la creación de tests unitarios básicos para nuevas funciones. El mínimo exigido es que el build no falle.
3.  **¿Cómo verificas que el cambio no rompe contratos?**
    El `FixAgent` carga las interfaces relacionadas (`.d.ts` o archivos de tipos) antes de intentar cualquier corrección de contrato.
4.  **¿Qué rol juega el code review humano?**
    Es el **filtro final**. La IA crea el PR y notifica por WhatsApp para que el humano revise el diff, valide los pasos de demo y apruebe el merge.

---

## 5. Debugging y manejo de errores

1.  **¿Tu primer paso es re-prompt, más contexto, o cambiar modelo?**
    El primer paso es **Auto-Correction** con el mismo modelo. Si falla 2 veces por cuota o red, se degrada a un modelo **Flash**.
2.  **¿Cuántas iteraciones toleras antes de escalar?**
    **3 iteraciones** de auto-corrección. Si persiste el error, se marca el Run como `failed` y se requiere intervención humana.
3.  **¿Cómo reduces el problema?**
    Aislando el módulo mediante el parseo de errores de build, enfocando al `FixAgent` solo en las líneas específicas que fallaron.
4.  **¿Qué haces cuando el modelo propone cambios “demasiado grandes”?**
    El `ReviewerAgent` rechaza cambios que superen el `maxLinesChanged` (50,000 líneas) o que borren archivos enteros sin justificación clara. Se INCENTIVAN implementaciones de 500-2000 líneas por run — esto no es “demasiado grande”, es el objetivo.

---

## 6. Tokens/costos y límites

1.  **¿Cómo mides consumo hoy?**
    Por tarea (`researchQueryCount`) y por conteo de tokens en cada ventana de prompt.
2.  **¿Qué umbrales disparan cambio de estrategia?**
    Superar los **200,000 tokens** en un solo prompt dispara el uso de modelos más eficientes (Flash) para optimizar el contexto.
3.  **¿Cómo decides entre “bien con planning” vs “rápido con fast”?**
    Tareas de arquitectura/codificación nueva usan **Planning (Pro)**. Tareas de resumen, fixes menores o logs usan **Fast (Flash)**.
4.  **¿Qué prácticas reducen tokens?**
    Uso de `diffs` en lugar de archivos completos cuando es posible y resúmenes de investigación previa en lugar de resultados crudos.

---

## 7. Seguridad / secretos / compliance

1.  **¿Qué política tienen sobre secrets?**
    **Jamás** se incluyen `.env` o credenciales. Se usa `safeStorage` y las llaves de API nunca salen del entorno seguro del Main Process.
2.  **¿Cómo sanitizas logs?**
    Se eliminan rutas absolutas del sistema de archivos del usuario (`C:\Users\...\`) antes de enviarlas al modelo.
3.  **¿Qué haces con vulnerabilidades conocidas?**
    El `SecurityAgent` las reporta. Si el fix es un Major Upgrade, se marca como no-accionable para evitar inestabilidad.
4.  **¿Qué reglas de acceso usan?**
    Integración vía **GitHub CLI con auth local** y cuentas corporativas configuradas en el entorno (VITE_GOOGLE_OAUTH).

---

## 8. Colaboración y Definición de "Terminado"

1.  **¿Cómo defines el tamaño máximo de PR?**
    Máximo **150 archivos** o **50,000 líneas** cambiadas por run de AutoDev. Mínimo recomendado: **500 líneas** por run para asegurar implementaciones significativas.
2.  **¿Cómo haces handoff?**
    Mediante un mensaje de WhatsApp que incluye: 1. Resumen técnico, 2. Lista de mejoras, 3. Link al PR.
3.  **¿Quién puede mergear?**
    Solo el **Humano (Fer)** tras revisar que el CI esté en verde y los cambios sean satisfactorios.
4.  **¿Cómo gestionan conflictos de estilo?**
    Se aplican reglas de **Prettier/ESLint** automáticas durante el build para forzar el estándar del equipo sobre el estilo de la IA.

---

## 9. Documentación y trazabilidad

1.  **¿Dónde queda el registro?**
    En `autodev-history.json` y en las descripciones de los Pull Requests.
2.  **¿Guardan los “Context Packs”?**
    No físicamente, pero se reconstruyen idénticamente basados en el historial del run.
3.  **¿Cómo etiquetan decisiones?**
    Las decisiones de arquitectura se reflejan en la actualización de este `AUTODEV_GUIDELINES.md` o en archivos `.md` de diseño.
4.  **¿Cómo aseguran que el conocimiento no se pierda?**
    Toda la lógica de operación está codificada en `autodev-prompts.ts`, actuando como un manual de procedimientos ejecutable.

---

## 10. Métricas

1.  **¿Qué métricas tienen ya?**
    Lead Time de ejecución y tasa de éxito de compilación (Build Pass Rate).
2.  **¿Cómo medirías “rework por IA”?**
    Contabilizando cuántas veces el `FixAgent` tuvo que actuar sobre un código generado anteriormente en el mismo Sprint.
3.  **¿Qué meta de distribución quieren?**
    70% Planning (para calidad) y 30% Fast (para mantenimiento/fixes rápidos).
4.  **¿Cómo calcular “costo por entrega”?**
    Sumando tokens de input/output por Run ID, cruzado con el tiempo de desarrollador ahorrado.
