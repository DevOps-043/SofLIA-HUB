# SofLIA Hub — Desktop AI Agent ✨🧬

**SofLIA Hub** es un ecosistema de productividad empresarial de alto rendimiento construido como aplicación de escritorio con **Electron**. Centraliza el control total de tu entorno digital con una estética de ingeniería premium, fusionando inteligencia artificial (**Gemini 3 Flash / Pro**), comunicación por **WhatsApp**, gestión de proyectos en **IRIS**, Google Workspace y automatización autónoma de la computadora — todo en una sola interfaz.

Utiliza modelos de lenguaje de última generación (**Gemini 3.1 Pro / Flash / Flash Lite**) para ofrecer una experiencia multimodal, autónoma y predictiva que se adapta dinámicamente a tu flujo de trabajo.

---

## 💎 ADN de Diseño: Ingeniería de Cristalismo

Hemos rediseñado la interfaz completa bajo principios de **Glassmorphism Industrial** y alineado al **SOFIA Design System**:

- **Interfaz Fluida**: Transparencias profundas (`backdrop-blur-md`), desenfoques gausianos y micro-glows ambientales. Menús flotantes altamente compactos y basados en íconos vectoriales dinámicos.
- **Tipografía de Precisión**: Headings en negrita técnica y etiquetas monoespaciadas para una legibilidad superior.
- **Acentos de Energía**: Paletas curadas en _Cyan Accent_ y _Ruby Alert_, junto con tonos _Aqua_ (`#00D4B3`) y azul profundo corporativo (`#0A2540`) para un contraste visual perfecto en modos claro y oscuro.

---

## 🚀 Módulos Operativos

### 💬 Chat IA Premium (Experiencia Multimodal)

Interfaz in-place altamente optimizada y responsiva al estilo de los mejores clientes de IA del mercado.

- **Edición Avanzada y Regeneración**: Edición limpia de prompts (in-place) que ocupa todo el ancho de texto. Borrado automático de historial subsecuente y regeneración del contexto completo al modificar peticiones anteriores.
- **Selector Evolutivo de Modelos**: Cambio fluido entre la familia Gemini 3.1 (Pro, Flash, Lite) y Gemini 2.5 priorizando potencia e innovación, envuelto en un diseño sumamente premium.
- **Asistente de Portapapeles Robusto**: Fallback nativo y visual con notificaciones en tiempo real para no perder fragmentos de código.

### 📱 Terminal de WhatsApp (Omnipotente)

Control absoluto de tu estación de trabajo desde cualquier lugar con redundancia de seguridad.

- **Ejecución Remota**: Apertura de procesos, búsqueda de sistemas de archivos y telemetría de pantalla.
- **Procesamiento Multimodal**: Análisis de flujos visuales, audios técnicos y documentos densos.
- **Sistema de Memoria de Rutas**: Escaneo proactivo (incluyendo rutas localizadas como OneDrive o "Escritorio") para armar un mapa en tiempo real usado por el agente para ubicar recursos instantáneamente.

### 🧠 Inteligencia Artificial (Multi-modelo)

Motor cognitivo centralizado con soporte multi-modelo y fallback automático.

- **Gemini 3 Flash/Pro**: Modelos primarios para chat, análisis y generación compleja.
- **Deep Research**: Investigación profunda con `deep-research-pro-preview`.
- **Audio Bidireccional**: Live API con soporte de audio nativo en tiempo real.
- **Generación de Imágenes**: Creación de imágenes con Gemini 2.5 Flash Image.
- **Prompt Optimizer**: Optimización automática de prompts para mejores resultados.

### 🖥️ Desktop Agent V2 (Agente Autónomo)

Operación directa de la interfaz gráfica de usuario (GUI) mediante visión artificial avanzada.

- **Stylistic Engine**: Ajuste de tono, verbosidad y personalidad del agente.
- **Matriz de Vigilancia**: Cronograma técnico para notificaciones proactivas con detección de ventanas de productividad y monitoreo de hardware nativo (CPU/RAM).

### 📁 IRIS — Project Hub

Gestión de proyectos, issues y sprints con interfaz glassmorphism.

- **Proyectos & Issues**: Sistema Kanban con estados, prioridades y asignaciones.
- **CRM-lite**: Empresas, contactos y oportunidades de negocio con deduplicación Jaccard.
- **Workflows BPM-lite**: Motor de estados finitos con aprobaciones HITL (Human-in-the-Loop).
- **Artefactos & Aprobaciones**: Generación IA de documentos con flujo de revisión humana.

### 📧 Google Workspace Hub

Puente bidireccional completo con servicios en la nube.

- **Google Calendar**: Gestión de eventos con soporte para Microsoft Outlook simultáneo.
- **Gmail**: Lectura, envío y gestión de hilos con etiquetas.
- **Google Drive**: Navegación, subida, descarga y detección automática de transcripciones (Meet, Plaud Note).
- **Google Chat**: Lectura y envío de mensajes en espacios de trabajo.

### 📁 Unidades de Almacenamiento (Proyectos)

Sistema inteligente de organización de nodos de conversación y tareas.

- **Inicialización de Directorios**: Creación de carpetas con estética minimalista y etiquetas de alta visibilidad.
- **Relocalización de Nodos**: Facilidad para mover flujos de datos entre diferentes sectores del proyecto.

### 🖱️ Computer Use V2 y AutoDev (Agente Autónomo)

Operación directa de la interfaz gráfica (GUI) y auto-programación mediante visión artificial y flujos multi-agente.

- **Navegación Visual Multi-Monitor**: Screenshots de alta frecuencia, capturando todas las pantallas conectadas y analizando árboles de accesibilidad.
- **Planificación Recursiva**: Desglose de tareas complejas en micro-operaciones verificables.
- **Sistema AutoDev**: Multi-agente de programación que verifica código huérfano e interdependencias al momento de crear y modificar archivos.

### 📧 Google Workspace Hub (Sincronización Total)

Puente de datos bidireccional con servicios en la nube.

- **Google Suite Integrada**: Gestión de correos en Gmail, control de eventos en Calendar, acceso a Drive y sincronización de mensajes de Google Chat.

### 🔄 Sistema de Auto-Actualización Continuo

Arquitectura _Zero-Downtime_ para distribución de versiones:

- **Electron Updater**: Actualizaciones silenciosas in-app desde GitHub Releases multiplataforma (soporte de builds nativos para Windows y macOS).
- **Notificaciones Reactivas**: Alertas in-app minimalistas sobre disponibilidad de nuevas versiones (como VS Code) y display de notas de actualización enriquecidas.

---

## ⚙️ Configuración del Núcleo

El despliegue requiere un entorno de variables `.env` estructurado:

```env
# Gemini Intelligence Matrix
VITE_GEMINI_API_KEY=...

# Supabase Lia (conversaciones, meetings)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# SOFIA (autenticación + organizaciones)
VITE_SOFIA_SUPABASE_URL=...
VITE_SOFIA_SUPABASE_ANON_KEY=...

# IRIS (Project Hub)
VITE_IRIS_SUPABASE_URL=...
VITE_IRIS_SUPABASE_ANON_KEY=...

# Google OAuth (Calendar + Gmail + Drive + Chat)
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_GOOGLE_OAUTH_CLIENT_SECRET=...
```

---

## 🛠️ Stack Tecnológico

| Capa                | Tecnología                                | Versión          |
| ------------------- | ----------------------------------------- | ---------------- |
| **Desktop**         | Electron                                  | 30.5.1           |
| **Frontend**        | React                                     | 18.2.0           |
| **Lenguaje**        | TypeScript                                | 5.7.3            |
| **Build**           | Vite + vite-plugin-electron               | 5.4.21           |
| **CSS**             | Tailwind CSS v4                           | 4.1.18           |
| **Animaciones**     | Framer Motion                             | 11.18.2          |
| **IA**              | Google Gemini (`@google/generative-ai`)   | 0.24.1           |
| **Base de Datos**   | 3x Supabase + better-sqlite3 (local)      | —                |
| **WhatsApp**        | @whiskeysockets/baileys                   | 7.0.0-rc.9       |
| **Google APIs**     | googleapis (Calendar, Gmail, Drive, Chat) | 171.4.0          |
| **OCR**             | tesseract.js                              | 5.0.5            |
| **Validación**      | Zod                                       | 3.24.2           |
| **Documentos**      | docx + exceljs                            | —                |
| **Actualizaciones** | electron-updater                          | 6.8.3            |
| **CI/CD**           | GitHub Actions                            | Multi-plataforma |

---

## 📦 Comandos de Desarrollo

```bash
npm run dev        # Servidor de desarrollo (Vite + Electron)
npm run build      # Build de producción + empaquetado
npm run lint       # ESLint (estricto, sin warnings)
npx tsc --noEmit   # Verificación TypeScript
npm run autodev    # Ejecutar AutoDev standalone
```

---

## 🛠️ Stack Tecnológico de Vanguardia

- **Core**: React 18 + Vite + **Tailwind CSS v4 (Engine v3 modded)**.
- **Runtime**: Electron con arquitectura de Micro-servicios (50+ servicios aislados) y pipeline CI/CD continuo.
- **Inteligencia**: Google Generative AI (**Gemini 3.1 Series**).
- **Visión**: Tesseract.js (OCR Local) + Gemini Vision.
- **Comunicaciones**: Baileys (Protocolo WA) + Nodemailer.

---

_Diseñado para ser el centro neurálgico de la productividad de alto rendimiento._ 🦾⚙️

**Desarrollado por [Pulse Hub](https://github.com/Memory-Bank) 🚀**
