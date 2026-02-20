# SofLIA Hub - Desktop AI Agent

SofLIA Hub es un asistente de productividad omnipotente que integra el control total de tu computadora con **WhatsApp** y la gestión de proyectos en **IRIS (Project Hub)**. Utiliza modelos avanzados de Gemini (2.5 Flash) para ofrecer una experiencia fluida, multimodal y altamente autónoma.

## 🚀 Características Principales

### 📱 Agente de WhatsApp

Controla tu computadora desde cualquier lugar enviando mensajes de WhatsApp.

- **Principio Omnipotente**: El agente puede realizar cualquier acción que un usuario haría sentado frente a su PC.
- **Detección Automática**: Identifica a los usuarios por su número de teléfono vinculado a su perfil de SofLIA Learning.
- **Multimodal**: Procesa y analiza imágenes, documentos (PDF, Word, Excel) y mensajes de voz enviados por chat.

### 🏗️ Integración con IRIS (Project Hub)

Gestión completa de tareas y proyectos directamente desde WhatsApp:

- **Lectura**: Consulta tus tareas asignadas, lista de proyectos y equipos.
- **Escritura**: Crea nuevos proyectos y tareas (issues) mediante comandos de voz o texto.
- **Actualización**: Cambia el estado (Backlog, To Do, Done) o la prioridad de cualquier tarea sobre la marcha.
- **Contexto Inteligente**: El agente verifica estados y prioridades disponibles por equipo para asegurar cambios válidos.

### 💻 Control de Escritorio

- **Visión Computacional**: Navega visualmente por la pantalla, hace clicks, escribe y usa aplicaciones GUI.
- **Gestión de Archivos**: Busca, lee, crea, mueve y envía archivos a través de WhatsApp.
- **Terminal y Código**: Ejecuta comandos seguros y lanza sesiones de Claude Code para desarrollo autónomo.
- **Automatización de Documentos**: Genera archivos Word (.docx) y Excel (.xlsx) profesionales basados en búsquedas web o datos de usuario.

## 🛡️ Seguridad y Uso en Grupos

SofLIA está diseñada para ser útil en grupos sin sacrificar la seguridad del host:

- **Activación Estricta**: En grupos, solo responde cuando se le menciona explícitamente como _"soflia"_, se le etiqueta, se responde a sus mensajes o se usa el prefijo `/soflia`.
- **Herramientas Bloqueadas**: Acciones destructivas o de control físico (apagar PC, ejecutar comandos de terminal, visión computacional) están desactivadas para usuarios en grupos.
- **Historial de Grupo**: Mantiene un búfer de contexto para entender conversaciones previas incluso en modo pasivo.

## ⚙️ Configuración

Para su funcionamiento, el proyecto requiere las siguientes variables en el archivo `.env`:

```env
# Gemini API Key
VITE_GEMINI_API_KEY=tu_api_key_aqui

# IRIS (Project Hub) Config
VITE_IRIS_SUPABASE_URL=...
VITE_IRIS_SUPABASE_ANON_KEY=...

# SOFIA (Auth) Config
VITE_SOFIA_SUPABASE_URL=...
VITE_SOFIA_SUPABASE_ANON_KEY=...

# WhatsApp Options
WA_AUTO_CONNECT=true
WA_ALLOWED_NUMBERS=["..."]
```

## 🛠️ Tecnologías

- **Core**: Electron + React + Vite + TypeScript.
- **IA**: Google Generative AI (Gemini 2.5 Flash).
- **Base de Datos**: Supabase (IRIS & SOFIA).
- **Gestión WhatsApp**: Baileys (Library for WhatsApp Web API).
