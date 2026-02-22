/**
 * WhatsApp Agent — Main-process Gemini agentic loop for WhatsApp messages.
 * Uses executeToolDirect() to call computer-use tools without IPC.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeToolDirect } from './computer-use-handlers';
import { app, shell, clipboard, desktopCapturer } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec as execCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { WhatsAppService } from './whatsapp-service';
import type { CalendarService } from './calendar-service';
import type { GmailService } from './gmail-service';
import type { DriveService } from './drive-service';
import type { GChatService } from './gchat-service';
import type { MemoryService } from './memory-service';
import type { KnowledgeService } from './knowledge-service';
import type { AutoDevService } from './autodev-service';
import {
  authenticateWhatsAppUser,
  tryAutoAuthByPhone,
  getWhatsAppSession,
  logoutWhatsAppUser,
  getTeams as irisGetTeams,
  getProjects as irisGetProjects,
  getIssues as irisGetIssues,
  getStatuses as irisGetStatuses,
  getPriorities as irisGetPriorities,
  createIssue as irisCreateIssue,
  updateIssueStatus as irisUpdateIssueStatus,
  createProject as irisCreateProject,
  updateProjectStatus as irisUpdateProjectStatus,
  buildIrisContextForWhatsApp,
  needsIrisData,
  isIrisAvailable,
} from './iris-data-main';

import { WorkflowManager } from './whatsapp-workflow-presentacion';

// ─── Tool definitions for WhatsApp (OMNIPOTENT — no blocked tools) ─
const BLOCKED_TOOLS_WA = new Set<string>([
  // Empty — SofLIA can do everything
]);

const CONFIRM_TOOLS_WA = new Set([
  'delete_item',
  'send_email',
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'run_in_terminal',
  'run_claude_code',
  'whatsapp_send_to_contact',
  'gmail_send',
  'gmail_trash',
  'google_calendar_delete',
  'gchat_send_message',
]);

// Tools blocked in GROUP context (security: don't allow group members to control host)
const GROUP_BLOCKED_TOOLS = new Set([
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'run_in_terminal',
  'run_claude_code',
  'use_computer',
  'delete_item',
  'write_file',
  'move_item',
  'clipboard_write',
  'clipboard_read',
]);

// ─── Tool declarations for Gemini (filtered for WhatsApp security) ─
const WA_TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'list_directory',
      description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
          show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'read_file',
      description: 'Lee y devuelve el contenido de un archivo de texto. Máximo 1MB.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Crea o sobrescribe un archivo con contenido de texto.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
          content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'create_directory',
      description: 'Crea una carpeta nueva.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
        required: ['path'],
      },
    },
    {
      name: 'move_item',
      description: 'Mueve o renombra un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
          destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'copy_item',
      description: 'Copia un archivo o carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
          destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
        },
        required: ['source_path', 'destination_path'],
      },
    },
    {
      name: 'delete_item',
      description: 'Envía un archivo o carpeta a la papelera. REQUIERE confirmación del usuario via WhatsApp.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
        required: ['path'],
      },
    },
    {
      name: 'get_file_info',
      description: 'Obtiene información de un archivo: tamaño, fechas, tipo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Busca archivos por nombre en un directorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          directory: { type: 'STRING' as const, description: 'Directorio donde buscar.' },
          pattern: { type: 'STRING' as const, description: 'Patrón de texto a buscar.' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'get_system_info',
      description: 'Obtiene información del sistema: SO, CPU, RAM, disco, y las rutas del escritorio, documentos y descargas del usuario.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_read',
      description: 'Lee el portapapeles.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'clipboard_write',
      description: 'Escribe texto en el portapapeles.',
      parameters: {
        type: 'OBJECT' as const,
        properties: { text: { type: 'STRING' as const, description: 'Texto a copiar.' } },
        required: ['text'],
      },
    },
    {
      name: 'whatsapp_send_file',
      description: 'Envía un archivo de la computadora al usuario directamente por WhatsApp. Usa esto cuando el usuario pida que le envíes un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a enviar.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo.' },
        },
        required: ['file_path'],
      },
    },
    // ─── Open file on computer ─────────────────────────────────────
    {
      name: 'open_file_on_computer',
      description: 'Abre un archivo en la computadora del usuario con su aplicación predeterminada (ej: PDF con Acrobat, Excel con Excel, etc.). Usa esto cuando el usuario diga "abre", "ábreme", "muéstrame" un archivo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a abrir.' },
        },
        required: ['file_path'],
      },
    },
    // ─── Open URL in browser ─────────────────────────────────────
    {
      name: 'open_url',
      description: 'Abre una URL en el navegador predeterminado de la computadora del usuario. Úsalo para abrir Gmail compose, páginas web, etc. Para enviar emails usa: https://mail.google.com/mail/?view=cm&to=EMAIL&su=ASUNTO&body=CONTENIDO',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          url: { type: 'STRING' as const, description: 'URL completa a abrir en el navegador.' },
        },
        required: ['url'],
      },
    },
    // ─── Web tools ────────────────────────────────────────────────
    {
      name: 'web_search',
      description: 'Busca información en internet. Usa esto para responder preguntas sobre temas generales, noticias, datos actuales, etc.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto de búsqueda.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_webpage',
      description: 'Lee y extrae el texto de una página web dada una URL.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          url: { type: 'STRING' as const, description: 'URL completa de la página web.' },
        },
        required: ['url'],
      },
    },
    // ─── Smart file search ──────────────────────────────────────
    {
      name: 'smart_find_file',
      description: 'Busca un archivo por nombre en TODA la computadora del usuario (escritorio, documentos, descargas, OneDrive, subcarpetas). Usa esto SIEMPRE que el usuario mencione un archivo por nombre. No necesitas saber la ruta — esta herramienta busca automáticamente en todas las ubicaciones comunes.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          filename: { type: 'STRING' as const, description: 'Nombre del archivo a buscar (parcial o completo). Ej: "servicios", "tarea.pdf", "notas"' },
        },
        required: ['filename'],
      },
    },
    // ─── Screenshot tool ──────────────────────────────────────────
    {
      name: 'take_screenshot_and_send',
      description: 'Toma una captura de pantalla de la computadora y la envía al usuario por WhatsApp. Usa esto cuando el usuario pida ver su pantalla, una captura, o screenshot.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    // ─── Email tools ───────────────────────────────────────────────
    {
      name: 'get_email_config',
      description: 'Verifica si el email está configurado para enviar correos.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'configure_email',
      description: 'Configura el email. Solo necesita email y contraseña de aplicación. El SMTP se detecta automáticamente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          email: { type: 'STRING' as const, description: 'Email del usuario.' },
          password: { type: 'STRING' as const, description: 'Contraseña de aplicación.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'send_email',
      description: 'Envía un email con texto y/o archivos adjuntos. Requiere confirmación del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Email del destinatario.' },
          subject: { type: 'STRING' as const, description: 'Asunto.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas de archivos a adjuntar.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    // ─── Memory tools ─────────────────────────────────────────────
    {
      name: 'save_lesson',
      description: 'Guarda una lección aprendida para no repetir el mismo error en el futuro. Úsalo cuando el usuario te corrija o cuando descubras algo importante (como una ruta correcta, una preferencia, etc.).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          lesson: { type: 'STRING' as const, description: 'La lección o dato a recordar. Ej: "El escritorio del usuario está en C:\\Users\\fysg5\\OneDrive\\Escritorio"' },
          context: { type: 'STRING' as const, description: 'Contexto breve de por qué se aprendió esto.' },
        },
        required: ['lesson'],
      },
    },
    {
      name: 'recall_memories',
      description: 'Consulta todas las lecciones aprendidas previamente. Úsalo al inicio de tareas para recordar preferencias y errores pasados.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    // ─── Knowledge Base (OpenClaw-style .md files) ────────────────
    {
      name: 'knowledge_save',
      description: 'Guarda información importante en la base de conocimiento persistente (MEMORY.md). Usa esto para guardar datos duraderos: preferencias del usuario, decisiones, configuraciones, datos del sistema, etc. Esta información se inyecta SIEMPRE en cada conversación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          content: { type: 'STRING' as const, description: 'El dato o conocimiento a guardar. Sé conciso y claro.' },
          section: { type: 'STRING' as const, description: 'Sección donde guardar. Opciones: "Preferencias Generales", "Lecciones Aprendidas", "Decisiones Arquitectónicas", "Datos del Sistema". También puedes crear secciones nuevas.' },
        },
        required: ['content'],
      },
    },
    {
      name: 'knowledge_update_user',
      description: 'Actualiza el perfil del usuario actual con información personal, preferencias o contexto laboral. Estos datos se inyectan automáticamente en cada conversación con este usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          section: { type: 'STRING' as const, description: 'Sección del perfil: "Datos Personales", "Preferencias de Comunicación", "Contexto Laboral", "Notas Importantes".' },
          content: { type: 'STRING' as const, description: 'La información a guardar en esa sección del perfil.' },
        },
        required: ['section', 'content'],
      },
    },
    {
      name: 'knowledge_search',
      description: 'Busca información en toda la base de conocimiento (MEMORY.md, perfiles de usuario, logs diarios). Usa esto para recordar conversaciones pasadas, buscar datos guardados previamente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto a buscar en los archivos de conocimiento.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'knowledge_log',
      description: 'Registra un evento o contexto en el log diario (memory/YYYY-MM-DD.md). Usa esto para eventos temporales, resúmenes de sesión, acciones realizadas. Los logs diarios NO se inyectan automáticamente — se consultan con knowledge_search.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          content: { type: 'STRING' as const, description: 'El evento o contexto a registrar.' },
        },
        required: ['content'],
      },
    },
    {
      name: 'knowledge_read',
      description: 'Lee el contenido de un archivo de conocimiento específico. Archivos disponibles: "MEMORY.md", "users/{phone}.md", "memory/YYYY-MM-DD.md".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file: { type: 'STRING' as const, description: 'Nombre del archivo a leer (ej: "MEMORY.md", "memory/2026-02-21.md").' },
        },
        required: ['file'],
      },
    },
    // ─── Computer Use ───────────────────────────────────────────
    {
      name: 'use_computer',
      description: 'Controla la computadora del usuario de forma autónoma: puede ver la pantalla, hacer clicks, escribir texto y presionar teclas. Usa esto para tareas que requieren interacción visual con la computadora, como: guardar un evento en Google Calendar, llenar formularios, hacer clicks en botones, navegar interfaces gráficas. Después de abrir una URL con open_url, usa use_computer para interactuar con la página abierta (hacer clicks, llenar campos, presionar botones).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          task: { type: 'STRING' as const, description: 'Descripción detallada de lo que debe hacer en la computadora. Sé específico. Ej: "Haz click en el botón Guardar de Google Calendar", "Escribe el asunto del email y presiona enviar", "Llena el formulario con nombre=Juan y email=juan@gmail.com y envíalo"' },
        },
        required: ['task'],
      },
    },
    // ─── System Control Tools ──────────────────────────────────────
    {
      name: 'list_processes',
      description: 'Lista los procesos activos de la computadora con su nombre, PID, uso de CPU y memoria. Usa esto cuando el usuario pregunte qué programas están abiertos o qué está consumiendo recursos.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          sort_by: { type: 'STRING' as const, description: 'Ordenar por: "cpu", "memory" o "name". Por defecto "memory".' },
          top: { type: 'NUMBER' as const, description: 'Cantidad de procesos a mostrar. Por defecto 15.' },
        },
      },
    },
    {
      name: 'kill_process',
      description: 'Cierra/termina un proceso de la computadora por su nombre o PID. REQUIERE confirmación del usuario. Usa esto cuando el usuario pida cerrar un programa, matar un proceso, o forzar el cierre de algo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          pid: { type: 'NUMBER' as const, description: 'ID del proceso a cerrar. Usa list_processes para obtener el PID.' },
          name: { type: 'STRING' as const, description: 'Nombre del proceso (ej: "chrome", "notepad"). Si se da nombre, cierra TODAS las instancias.' },
        },
      },
    },
    {
      name: 'lock_session',
      description: 'Bloquea la sesión de Windows (pantalla de bloqueo). REQUIERE confirmación. El usuario deberá ingresar su contraseña para desbloquear.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'shutdown_computer',
      description: 'Apaga la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de apagar. Por defecto 60.' },
        },
      },
    },
    {
      name: 'restart_computer',
      description: 'Reinicia la computadora. Se programa con 60 segundos de espera para poder cancelar con cancel_shutdown. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          delay_seconds: { type: 'NUMBER' as const, description: 'Segundos de espera antes de reiniciar. Por defecto 60.' },
        },
      },
    },
    {
      name: 'sleep_computer',
      description: 'Pone la computadora en modo de suspensión (sleep). REQUIERE confirmación.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'cancel_shutdown',
      description: 'Cancela un apagado o reinicio programado previamente con shutdown_computer o restart_computer.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'set_volume',
      description: 'Ajusta el volumen del sistema. Puede subir, bajar o silenciar/desilenciar.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          level: { type: 'NUMBER' as const, description: 'Nivel de volumen de 0 a 100. Si se omite, usa la acción.' },
          action: { type: 'STRING' as const, description: '"mute" para silenciar, "unmute" para desilenciar, "up" para subir 10%, "down" para bajar 10%.' },
        },
      },
    },
    {
      name: 'toggle_wifi',
      description: 'Activa o desactiva la conexión Wi-Fi. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enable: { type: 'BOOLEAN' as const, description: 'true para activar Wi-Fi, false para desactivar.' },
        },
        required: ['enable'],
      },
    },
    // ─── Full Power Tools ──────────────────────────────────────────
    {
      name: 'execute_command',
      description: 'Ejecuta un comando en la terminal del sistema (PowerShell en Windows). REQUIERE confirmación. Timeout de 30 segundos. Usa run_in_terminal para comandos de larga duración.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          command: { type: 'STRING' as const, description: 'Comando a ejecutar en PowerShell.' },
        },
        required: ['command'],
      },
    },
    {
      name: 'open_application',
      description: 'Abre una aplicación o archivo con su programa predeterminado. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          path: { type: 'STRING' as const, description: 'Ruta de la aplicación o archivo a abrir.' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_in_terminal',
      description: 'Abre una nueva ventana de terminal (PowerShell) VISIBLE y ejecuta un comando. La ventana queda abierta y el proceso sigue corriendo indefinidamente (sin timeout). Ideal para: npm run dev, servidores, builds largos, Claude Code, cualquier proceso de larga duración. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          command: { type: 'STRING' as const, description: 'Comando a ejecutar en la terminal. Ej: "npm run dev", "git pull && npm install", "claude \\"corrige los errores\\"" ' },
          working_directory: { type: 'STRING' as const, description: 'Directorio de trabajo. Si no se especifica, usa el home del usuario.' },
          keep_open: { type: 'BOOLEAN' as const, description: 'Si es true (defecto), la terminal queda abierta después de que el comando termine. Si es false, se cierra al terminar.' },
        },
        required: ['command'],
      },
    },
    {
      name: 'run_claude_code',
      description: 'Lanza Claude Code (claude CLI) en una terminal visible con una tarea específica. Claude Code trabajará autónomamente en la tarea mientras el usuario no está. La terminal queda abierta para ver el progreso. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          task: { type: 'STRING' as const, description: 'Tarea que Claude Code debe realizar. Ej: "Corrige todos los errores de TypeScript", "Implementa autenticación con JWT", "Agrega tests para el servicio de usuarios"' },
          project_directory: { type: 'STRING' as const, description: 'Directorio del proyecto. Si no se especifica, se intentará detectar automáticamente.' },
        },
        required: ['task'],
      },
    },
    {
      name: 'whatsapp_send_to_contact',
      description: 'Envía un mensaje de texto y/o un archivo a OTRO número de WhatsApp (no al usuario actual). Útil para: enviar archivos a contactos, reenviar documentos, enviar mensajes a nombre del usuario. REQUIERE confirmación.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          phone_number: { type: 'STRING' as const, description: 'Número de teléfono del destinatario con código de país. Ej: "5215512345678" (México), "573001234567" (Colombia).' },
          message: { type: 'STRING' as const, description: 'Mensaje de texto a enviar. Opcional si se envía archivo.' },
          file_path: { type: 'STRING' as const, description: 'Ruta del archivo a enviar. Opcional si se envía solo texto.' },
          caption: { type: 'STRING' as const, description: 'Texto que acompaña al archivo. Solo aplica si se envía archivo.' },
        },
        required: ['phone_number'],
      },
    },
    {
      name: 'create_document',
      description: 'Crea un documento (Word, Excel, PDF o Markdown) con contenido generado. Puede crear informes, contratos, resúmenes, tablas, etc. Después de crearlo puedes enviarlo por WhatsApp con whatsapp_send_file.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          type: { type: 'STRING' as const, description: '"word" para Word (.docx), "excel" para Excel (.xlsx), "pdf" para PDF (.pdf), o "md" para Markdown (.md).' },
          filename: { type: 'STRING' as const, description: 'Nombre del archivo sin extensión. Ej: "Informe de ventas", "Contrato de servicios".' },
          content: { type: 'STRING' as const, description: 'Texto del documento. Usa saltos de línea y marcadores Markdown como ## para PDF y Word. Para Excel: JSON con formato [{"Columna1": "valor", "Columna2": "valor"}, ...] representando filas.' },
          save_directory: { type: 'STRING' as const, description: 'Carpeta donde guardar. Si no se especifica, se guarda en el escritorio del usuario.' },
          title: { type: 'STRING' as const, description: 'Título principal del documento (aparece como encabezado en Word o nombre de hoja en Excel).' },
        },
        required: ['type', 'filename', 'content'],
      },
    },
    // ─── IRIS / Project Hub Tools ──────────────────────────────────
    {
      name: 'iris_login',
      description: 'Autentica al usuario de WhatsApp con el sistema Project Hub (IRIS). Necesita email y contraseña. Después de autenticarse, podrá consultar sus tareas, proyectos y equipos. Solo úsala cuando el usuario te dé sus credenciales explícitamente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          email: { type: 'STRING' as const, description: 'Email o nombre de usuario del sistema SOFIA/Project Hub.' },
          password: { type: 'STRING' as const, description: 'Contraseña del usuario.' },
        },
        required: ['email', 'password'],
      },
    },
    {
      name: 'iris_logout',
      description: 'Cierra la sesión del usuario en el sistema Project Hub. Sus datos de IRIS ya no estarán vinculados a su número de WhatsApp.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'iris_get_my_tasks',
      description: 'Obtiene las tareas/issues asignadas al usuario autenticado en Project Hub. El usuario debe haberse autenticado previamente con iris_login.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          project_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por proyecto específico.' },
          limit: { type: 'NUMBER' as const, description: 'Máximo de tareas a mostrar. Por defecto 20.' },
        },
      },
    },
    {
      name: 'iris_get_projects',
      description: 'Lista los proyectos disponibles en Project Hub. Puede filtrar por equipo.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          team_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por equipo específico.' },
        },
      },
    },
    {
      name: 'iris_get_teams',
      description: 'Lista los equipos disponibles en Project Hub.',
      parameters: { type: 'OBJECT' as const, properties: {} },
    },
    {
      name: 'iris_get_issues',
      description: 'Lista las issues/tareas en Project Hub. Puede filtrar por equipo, proyecto o asignado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          team_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por equipo.' },
          project_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por proyecto.' },
          assignee_id: { type: 'STRING' as const, description: 'Opcional. Filtrar por usuario asignado (user_id).' },
          limit: { type: 'NUMBER' as const, description: 'Máximo de issues a mostrar. Por defecto 20.' },
        },
      },
    },
    // ─── IRIS Write Tools ─────────────────────────────────────────
    {
      name: 'iris_create_task',
      description: 'Crea una nueva tarea/issue en Project Hub. Requiere estar autenticado. El team_id es obligatorio (puedes obtenerlo de iris_get_teams). El título es obligatorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          team_id: { type: 'STRING' as const, description: 'ID del equipo donde crear la tarea (obligatorio).' },
          title: { type: 'STRING' as const, description: 'Título de la tarea (obligatorio).' },
          description: { type: 'STRING' as const, description: 'Descripción detallada de la tarea.' },
          project_id: { type: 'STRING' as const, description: 'ID del proyecto para asociar la tarea.' },
          priority_id: { type: 'STRING' as const, description: 'ID de la prioridad (usa iris_get_statuses para ver prioridades disponibles).' },
          assignee_id: { type: 'STRING' as const, description: 'ID del usuario a asignar. Usa el userId del usuario autenticado para auto-asignarse.' },
          due_date: { type: 'STRING' as const, description: 'Fecha de vencimiento en formato YYYY-MM-DD.' },
          status_name: { type: 'STRING' as const, description: 'Nombre del estado inicial (ej: "Backlog", "To Do", "In Progress"). Si no se especifica, se usa el estado predeterminado del equipo.' },
        },
        required: ['team_id', 'title'],
      },
    },
    {
      name: 'iris_update_task_status',
      description: 'Cambia el estado de una tarea/issue existente en Project Hub. Puede buscar por issue_id o issue_number. Los estados típicos son: Backlog, To Do, In Progress, In Review, Done, Cancelled.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          issue_id: { type: 'STRING' as const, description: 'ID único de la tarea (UUID). Usar si se conoce.' },
          issue_number: { type: 'NUMBER' as const, description: 'Número de la tarea (ej: #5). Alternativa a issue_id.' },
          team_id: { type: 'STRING' as const, description: 'ID del equipo (ayuda a encontrar la tarea por número).' },
          new_status_name: { type: 'STRING' as const, description: 'Nombre del nuevo estado: "Backlog", "To Do", "In Progress", "In Review", "Done", "Cancelled".' },
          new_status_id: { type: 'STRING' as const, description: 'Alternativa: ID directo del nuevo estado.' },
        },
      },
    },
    {
      name: 'iris_create_project',
      description: 'Crea un nuevo proyecto en Project Hub. Requiere estar autenticado. El nombre del proyecto es obligatorio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          project_name: { type: 'STRING' as const, description: 'Nombre del proyecto (obligatorio).' },
          project_key: { type: 'STRING' as const, description: 'Clave corta del proyecto (máximo 5 letras, ej: "MKTG", "DEV"). Se genera automáticamente si no se especifica.' },
          team_id: { type: 'STRING' as const, description: 'ID del equipo al que pertenece el proyecto.' },
          description: { type: 'STRING' as const, description: 'Descripción del proyecto.' },
          priority_level: { type: 'STRING' as const, description: 'Nivel de prioridad: "urgent", "high", "medium", "low", "none". Por defecto "medium".' },
          start_date: { type: 'STRING' as const, description: 'Fecha de inicio en formato YYYY-MM-DD.' },
          target_date: { type: 'STRING' as const, description: 'Fecha objetivo de finalización en formato YYYY-MM-DD.' },
        },
        required: ['project_name'],
      },
    },
    {
      name: 'iris_update_project_status',
      description: 'Cambia el estado de un proyecto existente en Project Hub. Los estados posibles son: planning, active, on_hold, completed, cancelled, archived.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          project_id: { type: 'STRING' as const, description: 'ID del proyecto a actualizar (obligatorio).' },
          new_status: { type: 'STRING' as const, description: 'Nuevo estado del proyecto: "planning", "active", "on_hold", "completed", "cancelled", "archived".' },
        },
        required: ['project_id', 'new_status'],
      },
    },
    {
      name: 'iris_get_statuses',
      description: 'Lista los estados y prioridades disponibles para un equipo en Project Hub. Útil antes de crear tareas o cambiar estados.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          team_id: { type: 'STRING' as const, description: 'ID del equipo para obtener sus estados configurados.' },
        },
        required: ['team_id'],
      },
    },
    // ─── Google Calendar API (direct — no .ics files) ──────────────
    {
      name: 'google_calendar_create',
      description: 'Crea un evento DIRECTAMENTE en Google Calendar del usuario via API (sin archivos .ics). Requiere que el usuario haya conectado su Google Calendar en SofLIA Hub. Usa este en lugar de create_calendar_event cuando Google esté conectado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          title: { type: 'STRING' as const, description: 'Título del evento.' },
          start_date: { type: 'STRING' as const, description: 'Fecha/hora de inicio en formato ISO: "2025-03-15T09:00:00"' },
          end_date: { type: 'STRING' as const, description: 'Fecha/hora de fin. Si no se especifica, dura 1 hora.' },
          description: { type: 'STRING' as const, description: 'Descripción del evento.' },
          location: { type: 'STRING' as const, description: 'Ubicación del evento.' },
        },
        required: ['title', 'start_date'],
      },
    },
    {
      name: 'google_calendar_get_events',
      description: 'Obtiene los eventos del Google Calendar del usuario. Útil para: "¿qué tengo hoy?", "¿qué tengo mañana?", "¿cuál es mi agenda?". Soporta buscar en un rango de fechas.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          start_date: { type: 'STRING' as const, description: 'Fecha de inicio a buscar en formato ISO 8601 (ej: "2026-02-21T00:00:00"). Si no se especifica, asume el inicio del día de hoy.' },
          end_date: { type: 'STRING' as const, description: 'Fecha de fin a buscar en formato ISO 8601. Si no se especifica, asume el final del día de la fecha de inicio.' },
        },
      },
    },
    {
      name: 'google_calendar_delete',
      description: 'Elimina un evento de Google Calendar por su ID. Primero usa google_calendar_get_events para obtener el ID.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          event_id: { type: 'STRING' as const, description: 'ID del evento a eliminar.' },
        },
        required: ['event_id'],
      },
    },
    // ─── Gmail API ─────────────────────────────────────────────────
    {
      name: 'gmail_send',
      description: 'Envía un email via Gmail API (no necesita configurar SMTP). Soporta adjuntar archivos locales. Requiere que el usuario haya conectado Google en SofLIA Hub. Usa este en lugar de send_email cuando Google esté conectado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          to: { type: 'STRING' as const, description: 'Email(s) del destinatario, separados por coma.' },
          subject: { type: 'STRING' as const, description: 'Asunto del email.' },
          body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
          cc: { type: 'STRING' as const, description: 'CC emails, separados por coma.' },
          is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
          attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas locales de archivos a adjuntar al email. Ejemplo: ["C:\\Users\\user\\Documents\\archivo.pdf"]' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'gmail_get_messages',
      description: 'Lee los emails recientes del usuario via Gmail API. Puede filtrar por query (ej: "from:juan@gmail.com", "is:unread", "subject:factura").',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Query de búsqueda Gmail (ej: "is:unread", "from:boss@company.com", "subject:reporte").' },
          max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de emails. Por defecto 10.' },
        },
      },
    },
    {
      name: 'gmail_read_message',
      description: 'Lee el contenido completo de un email específico por su ID. Usa gmail_get_messages primero para obtener IDs.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a leer.' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_trash',
      description: 'Envía un email a la papelera de Gmail.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a eliminar.' },
        },
        required: ['message_id'],
      },
    },
    {
      name: 'gmail_get_labels',
      description: 'Lista todas las etiquetas/labels de Gmail del usuario (incluyendo las del sistema como INBOX, SPAM, etc. y las creadas por el usuario).',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'gmail_create_label',
      description: 'Crea una nueva etiqueta/label en Gmail. Si la etiqueta ya existe, devuelve la existente.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          name: { type: 'STRING' as const, description: 'Nombre de la etiqueta a crear (ej: "GitHub", "Open AI", "Trabajo").' },
        },
        required: ['name'],
      },
    },
    {
      name: 'gmail_modify_labels',
      description: 'Agrega o quita etiquetas de un email. Usa esto para organizar correos en etiquetas/carpetas. Para mover a una etiqueta: add_labels con el ID de la etiqueta. Para quitar de INBOX: remove_labels con "INBOX".',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_id: { type: 'STRING' as const, description: 'ID del mensaje a modificar.' },
          add_labels: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'IDs de etiquetas a agregar al mensaje.' },
          remove_labels: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'IDs de etiquetas a quitar del mensaje (ej: "INBOX" para sacarlo de la bandeja de entrada).' },
        },
        required: ['message_id'],
      },
    },
    // ─── Google Drive API ──────────────────────────────────────────
    {
      name: 'drive_list_files',
      description: 'Lista archivos del Google Drive del usuario. Puede filtrar por carpeta.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          folder_id: { type: 'STRING' as const, description: 'ID de carpeta para listar. Si no se especifica, lista la raíz.' },
          max_results: { type: 'NUMBER' as const, description: 'Máximo de archivos. Por defecto 20.' },
        },
      },
    },
    {
      name: 'drive_search',
      description: 'Busca archivos en Google Drive del usuario por nombre.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          query: { type: 'STRING' as const, description: 'Texto a buscar en nombres de archivos de Drive.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'drive_download',
      description: 'Descarga un archivo de Google Drive a la computadora del usuario. Soporta archivos normales Y Google Docs/Sheets/Slides (se exportan automáticamente a PDF/XLSX). Después puedes enviarlo por WhatsApp con whatsapp_send_file o por email con gmail_send.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_id: { type: 'STRING' as const, description: 'ID del archivo en Drive.' },
          file_name: { type: 'STRING' as const, description: 'Nombre para guardar el archivo localmente.' },
        },
        required: ['file_id', 'file_name'],
      },
    },
    {
      name: 'drive_upload',
      description: 'Sube un archivo de la computadora del usuario a Google Drive.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          file_path: { type: 'STRING' as const, description: 'Ruta local del archivo a subir.' },
          folder_id: { type: 'STRING' as const, description: 'ID de carpeta destino en Drive. Si no se especifica, se sube a la raíz.' },
          name: { type: 'STRING' as const, description: 'Nombre del archivo en Drive. Si no se especifica, usa el nombre local.' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'drive_create_folder',
      description: 'Crea una carpeta en Google Drive del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          name: { type: 'STRING' as const, description: 'Nombre de la carpeta.' },
          parent_id: { type: 'STRING' as const, description: 'ID de carpeta padre. Si no se especifica, se crea en la raíz.' },
        },
        required: ['name'],
      },
    },
    // ─── Google Chat API ──────────────────────────────────────────
    {
      name: 'gchat_list_spaces',
      description: 'Lista los espacios (chats, grupos, salas) de Google Chat del usuario.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'gchat_get_messages',
      description: 'Lee los mensajes recientes de un espacio de Google Chat. Usa gchat_list_spaces primero para obtener el nombre del espacio.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio (ej: "spaces/AAAAA"). Obtener con gchat_list_spaces.' },
          max_results: { type: 'NUMBER' as const, description: 'Cantidad máxima de mensajes. Por defecto 25.' },
        },
        required: ['space_name'],
      },
    },
    {
      name: 'gchat_send_message',
      description: 'Envía un mensaje de texto a un espacio de Google Chat. Puede responder en un hilo si se proporciona thread_name.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio destino (ej: "spaces/AAAAA").' },
          text: { type: 'STRING' as const, description: 'Texto del mensaje a enviar.' },
          thread_name: { type: 'STRING' as const, description: 'Nombre del hilo para responder (opcional). Si no se especifica, crea un nuevo mensaje.' },
        },
        required: ['space_name', 'text'],
      },
    },
    {
      name: 'gchat_add_reaction',
      description: 'Agrega una reacción emoji a un mensaje de Google Chat.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          message_name: { type: 'STRING' as const, description: 'Nombre completo del mensaje (ej: "spaces/AAAAA/messages/BBBBB").' },
          emoji: { type: 'STRING' as const, description: 'Emoji unicode para la reacción (ej: "👍", "❤️", "😂").' },
        },
        required: ['message_name', 'emoji'],
      },
    },
    {
      name: 'gchat_get_members',
      description: 'Lista los miembros de un espacio de Google Chat.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          space_name: { type: 'STRING' as const, description: 'Nombre del espacio (ej: "spaces/AAAAA").' },
        },
        required: ['space_name'],
      },
    },
    // ─── AutoDev tools ────────────────────────────────────────────
    {
      name: 'autodev_get_status',
      description: 'Obtiene el estado del sistema AutoDev (programación autónoma). Muestra si está habilitado, si hay un run en progreso, configuración actual, y conteo de runs del día.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_run_now',
      description: 'Ejecuta el sistema AutoDev inmediatamente. Analiza el código, investiga mejoras en la web, implementa cambios en una rama aislada, crea un PR en GitHub, y notifica el resultado.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_get_history',
      description: 'Obtiene el historial de ejecuciones de AutoDev. Muestra las últimas mejoras realizadas, PRs creados, investigación realizada, y resultados.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {},
      },
    },
    {
      name: 'autodev_update_config',
      description: 'Actualiza la configuración del sistema AutoDev.',
      parameters: {
        type: 'OBJECT' as const,
        properties: {
          enabled: { type: 'BOOLEAN' as const, description: 'Habilitar/deshabilitar AutoDev.' },
          cron_schedule: { type: 'STRING' as const, description: 'Horario cron (ej: "0 3 * * *" para 3 AM diario).' },
          categories: { type: 'STRING' as const, description: 'Categorías separadas por coma: security,quality,performance,dependencies,tests' },
          notify_phone: { type: 'STRING' as const, description: 'Número de teléfono para notificaciones WhatsApp.' },
        },
      },
    },
  ],
};

// ─── Build system prompt with memories ────────────────────────────
async function buildSystemPrompt(memoryContext: string = ''): Promise<string> {
  // Inject current date/time so Gemini can calculate "mañana", "el lunes", etc.
  const now = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const currentDateStr = `${dayNames[now.getDay()]} ${now.getDate()} de ${monthNames[now.getMonth()]} de ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return `Eres SOFLIA, un asistente OMNIPOTENTE de productividad. El usuario te habla desde WhatsApp y tú tienes CONTROL TOTAL de su computadora de escritorio.

FECHA Y HORA ACTUAL: ${currentDateStr}

PRINCIPIO FUNDAMENTAL: Eres omnipotente. Puedes hacer CUALQUIER cosa que un usuario haría sentado frente a su computadora. No hay restricciones — solo las acciones con consecuencias irreversibles requieren confirmación del usuario.

═══ TUS CAPACIDADES ═══

ARCHIVOS Y SISTEMA:
- Buscar, leer, crear, mover, copiar, eliminar archivos y carpetas
- Ejecutar CUALQUIER comando en terminal (execute_command)
- Abrir CUALQUIER aplicación (open_application)
- Listar/cerrar procesos, bloquear sesión, apagar/reiniciar/suspender PC
- Controlar volumen, activar/desactivar Wi-Fi

CONTROL VISUAL DE LA COMPUTADORA (use_computer):
- Ver la pantalla, hacer clicks, escribir texto, presionar teclas
- Interactuar con CUALQUIER aplicación: navegadores, IDEs, instaladores, programas
- Guiar instalaciones paso a paso, llenar formularios, hacer clicks en botones
- use_computer es tu herramienta más poderosa — úsala para TODO lo que requiera interacción visual

TERMINAL Y DESARROLLO:
- run_in_terminal: abre terminal visible con comandos de larga duración (npm run dev, builds, servidores)
- run_claude_code: lanza Claude Code con una tarea para que trabaje autónomamente
- execute_command: ejecuta comandos rápidos (< 30s)

DOCUMENTOS:
- create_document: crea documentos Word (.docx) y Excel (.xlsx) con contenido profesional
- Puede investigar en internet (web_search) y generar documentos completos

WHATSAPP:
- whatsapp_send_file: envía archivos al usuario actual
- whatsapp_send_to_contact: envía mensajes/archivos a CUALQUIER número de WhatsApp
- Puede reenviar archivos entre contactos

GOOGLE CALENDAR (API directa):
- google_calendar_create: crea eventos DIRECTAMENTE en Google Calendar (sin archivos .ics)
- google_calendar_get_events: consulta la agenda del día
- google_calendar_delete: elimina eventos del calendario
- IMPORTANTE: Usa estos tools en lugar de create_calendar_event y open_url con calendar.google.com

GMAIL (API directa):
- gmail_send: envía emails via Gmail (sin configurar SMTP). SOPORTA ADJUNTOS: usa attachment_paths con rutas locales de archivos
- gmail_get_messages: lee emails recientes, busca por query
- gmail_read_message: lee el contenido completo de un email
- gmail_trash: elimina un email
- gmail_get_labels: lista todas las etiquetas del usuario
- gmail_create_label: crea una nueva etiqueta (si ya existe, devuelve la existente)
- gmail_modify_labels: agrega o quita etiquetas de un email. Para organizar: 1) crear label con gmail_create_label, 2) agregar label al mensaje con gmail_modify_labels (add_labels con el ID), 3) opcionalmente quitar de INBOX con remove_labels: ["INBOX"]
- IMPORTANTE: Usa gmail_send en lugar de send_email o open_url con mail.google.com
- IMPORTANTE: Para organizar correos en etiquetas, SIEMPRE usa este flujo: gmail_get_messages → gmail_create_label → gmail_modify_labels

GOOGLE DRIVE:
- drive_list_files: lista archivos del Drive
- drive_search: busca archivos en Drive por nombre
- drive_download: descarga un archivo de Drive a la computadora. Soporta Google Docs/Sheets/Slides (se exportan automáticamente a PDF/XLSX). Después puedes enviarlo por WhatsApp (whatsapp_send_file) o por email (gmail_send con attachment_paths)
- drive_upload: sube un archivo local a Drive
- drive_create_folder: crea carpetas en Drive

GOOGLE CHAT:
- gchat_list_spaces: lista espacios/chats/grupos de Google Chat
- gchat_get_messages: lee mensajes recientes de un espacio (usa gchat_list_spaces primero para obtener space_name)
- gchat_send_message: envía mensaje a un espacio de Google Chat. Puede responder en hilo con thread_name
- gchat_add_reaction: agrega reacción emoji a un mensaje de Google Chat
- gchat_get_members: lista miembros de un espacio de Google Chat

AUTODEV (PROGRAMACIÓN AUTÓNOMA):
- autodev_get_status: ver estado del sistema AutoDev (habilitado, run en progreso, config)
- autodev_run_now: ejecutar AutoDev inmediatamente — analiza código, investiga mejoras en la web, implementa en rama aislada, crea PR
- autodev_get_history: ver historial de mejoras autónomas realizadas (PRs, cambios, investigación)
- autodev_update_config: configurar AutoDev (habilitar/deshabilitar, horario, categorías, notificaciones)
- AutoDev investiga ANTES de implementar: busca CVEs, lee changelogs, consulta documentación oficial

INTERNET:
- open_url: abre URLs en el navegador
- web_search: busca información en internet
- read_webpage: lee contenido de páginas web

PROJECT HUB (IRIS) — Gestión de Proyectos:
- Los usuarios son identificados AUTOMÁTICAMENTE por su número de WhatsApp si lo tienen registrado en su perfil de SofLIA Learning
- iris_login: SOLO usar si el usuario NO fue detectado automáticamente y necesita autenticarse manualmente con email/contraseña
- iris_logout: cierra la sesión del usuario en Project Hub
- iris_create_task: crea nuevas tareas/issues (requiere team_id y título)
- iris_get_my_tasks / iris_get_issues: busca tareas existentes
- iris_update_task_status: cambia el estado de una tarea (To Do, In Progress, Done, etc.)
- iris_create_project: crea proyectos nuevos
- iris_update_project_status: cambia el estado de un proyecto (active, completed, etc.)
- iris_get_projects / iris_get_teams: lista proyectos y equipos
- iris_get_statuses: consulta estados y prioridades disponibles para un equipo
- Si el usuario fue detectado automáticamente, NO le pidas credenciales — ya está autenticado
- Si el usuario NO fue detectado y pregunta por sus datos, indícale que puede: (1) registrar su número de teléfono en su perfil de SofLIA Learning para acceso automático, o (2) enviar su email y contraseña para iniciar sesión manual
- SEGURIDAD: NUNCA repitas la contraseña ni la guardes en la conversación
- ¡EJECUTA las creaciones directamente si el usuario te lo pide! (ej: "crea una tarea para mañana")

═══ FLUJOS DE TRABAJO ═══

CONTROL VISUAL (use_computer):
Cuando necesites interactuar con cualquier programa visualmente:
1. Abre la app (open_application o open_url)
2. Usa use_computer para interactuar (clicks, escribir, navegar)
Ejemplos: instalar un programa, configurar ajustes, llenar formularios, usar cualquier app GUI

DESARROLLO REMOTO:
- "Abre Claude Code y corrige los errores" → run_claude_code con la tarea
- "Ejecuta npm run build" → run_in_terminal (queda corriendo visible)
- "Instala la extensión X en VS Code" → open_application + use_computer

DOCUMENTOS:
- "Escribe un contrato de servicios" → create_document type:"word" con contenido completo
- "Haz una tabla de gastos" → create_document type:"excel" con datos en JSON
- Después de crear: envíalo con whatsapp_send_file

ENVÍO A CONTACTOS:
- "Envíale el archivo X a Juan (+52...)" → smart_find_file + whatsapp_send_to_contact

GOOGLE INTEGRADO (prioridad sobre navegador):
- "Créame un evento mañana a las 9" → google_calendar_create (directo via API)
- "¿Qué tengo en mi agenda?" → google_calendar_get_events
- "Envía un email a juan@..." → gmail_send (directo via API, sin SMTP)
- "Envía un email con el archivo X adjunto" → smart_find_file + gmail_send con attachment_paths
- "¿Qué emails no he leído?" → gmail_get_messages con query "is:unread"
- "Organiza mis correos por etiquetas" → gmail_get_messages + gmail_create_label (para cada categoría) + gmail_modify_labels (agregar label a cada mensaje)
- "Busca el archivo X en mi Drive" → drive_search
- "Envíame el archivo X de mi Drive" → drive_search + drive_download + whatsapp_send_file
- "Envía por email el archivo X de mi Drive" → drive_search + drive_download + gmail_send con attachment_paths
- "Sube este archivo a Drive" → smart_find_file + drive_upload
- "Envía un mensaje en Google Chat a mi equipo" → gchat_list_spaces + gchat_send_message
- "¿Qué mensajes hay en mi Google Chat?" → gchat_list_spaces + gchat_get_messages
- "Reacciona al último mensaje en el chat de proyecto" → gchat_get_messages + gchat_add_reaction
- IMPORTANTE: SIEMPRE usa las APIs directas (google_calendar_*, gmail_*, drive_*, gchat_*) en lugar de abrir URLs en el navegador

NAVEGADOR (solo si Google API no aplica):
- Maps/YouTube/Docs/Sheets: open_url + use_computer para interactuar

═══ REGLAS DE AUTONOMÍA ═══

1. EJECUTA, NO PREGUNTES: Cuando la tarea sea clara, ejecútala directamente. No digas "voy a hacer X" — simplemente hazlo y reporta el resultado.
2. COMPLETA TODO: Nunca dejes pasos para el usuario. Si necesitas buscar un archivo, buscarlo. Si necesitas abrir algo, ábrelo. Si necesitas crear algo, créalo.
3. BUSCA SIEMPRE: Cuando mencionen un archivo, usa smart_find_file. NUNCA pidas la ruta.
4. CONFIRMA SOLO LO DESTRUCTIVO: Solo pide confirmación para: eliminar archivos, ejecutar comandos, abrir apps, cerrar procesos, apagar/reiniciar, enviar a otros contactos. Para crear archivos, buscar, leer, etc. — hazlo directamente.
5. USA use_computer AGRESIVAMENTE: Si necesitas interactuar con cualquier programa, usa use_computer. No le digas al usuario "haz click en X" — hazlo tú.
6. APRENDE: Usa save_lesson cuando descubras algo útil o el usuario te corrija.

═══ MEMORIA PERSISTENTE (Knowledge Base) ═══

Tienes una base de conocimiento en archivos .md que SIEMPRE se inyecta en tu contexto:
- MEMORY.md: Conocimiento global permanente (preferencias, lecciones, configuraciones)
- Perfil de usuario: Datos personales y preferencias de cada usuario

REGLAS DE MEMORIA:
1. Cuando el usuario te diga su nombre, rol, empresa, o preferencias → usa knowledge_update_user para actualizar su perfil
2. Cuando descubras algo importante del sistema (rutas, configuraciones, patrones) → usa knowledge_save
3. Cuando completes una tarea relevante o sesión larga → usa knowledge_log para registrar en el log diario
4. Cuando necesites recordar algo de conversaciones pasadas → usa knowledge_search
5. Si el usuario dice "recuerda esto" o "no olvides que..." → SIEMPRE guárdalo con knowledge_save o knowledge_update_user
6. PROACTIVAMENTE actualiza el perfil del usuario cuando descubras datos nuevos (no esperes a que te lo pidan)

═══ FORMATO WHATSAPP ═══

- NUNCA uses markdown (#, ##, **, \`\`\`, -)
- Usa texto plano natural, *negritas de WhatsApp* con un asterisco
- Respuestas cortas y directas
- Listas con emojis o números simples
- NO expliques antes de actuar — actúa y responde con el resultado

Responde en español a menos que pidan otro idioma.${memoryContext}`;
}

// ─── Conversation history per session (DM: by number, Group: by group+number) ──
const MAX_HISTORY = 20;
const conversations = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();

// ─── Pending confirmations ──────────────────────────────────────────
interface PendingConfirmation {
  toolName: string;
  args: Record<string, any>;
  resolve: (confirmed: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingConfirmations = new Map<string, PendingConfirmation>();

// ─── Model selection: prefer stable models for main process ─────────
const WA_MODEL = 'gemini-2.5-flash';

// ─── Smart file search — uses PowerShell for reliable native search ──
const execAsync = promisify(execCb);

async function smartFindFile(filename: string): Promise<{ success: boolean; results: Array<{ name: string; path: string; size: string }>; query: string }> {
  const home = os.homedir().replace(/\//g, '\\');
  const results: Array<{ name: string; path: string; size: string }> = [];
  const seenPaths = new Set<string>();

  // Sanitize: remove dangerous chars but KEEP Unicode letters (accents, ñ, etc.)
  const sanitized = filename.replace(/["`$;|&<>{}()[\]!^~]/g, '').trim();
  if (!sanitized) {
    return { success: false, results: [], query: filename };
  }

  // Always work with accent-stripped version for reliable matching
  const noAccents = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Split into individual words for multi-word searches (e.g. "requerimientos citas medicas")
  const searchWords = noAccents.split(/\s+/).filter(w => w.length >= 3);

  console.log(`[smart_find_file] Searching for: "${sanitized}" (normalized: "${noAccents}", words: [${searchWords.join(', ')}]) in ${home}`);

  function addResult(fullPath: string, bytes: number) {
    const key = fullPath.toLowerCase();
    if (seenPaths.has(key)) return;
    seenPaths.add(key);
    let size = '';
    if (bytes < 1024) size = `${bytes} B`;
    else if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(1)} KB`;
    else size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    results.push({ name: path.basename(fullPath), path: fullPath, size });
  }

  // ── Strategy 1: PowerShell Get-ChildItem with accent normalization on BOTH sides ──
  try {
    const tmpDir = app.getPath('temp');
    const scriptPath = path.join(tmpDir, 'soflia_search.ps1');
    const outputPath = path.join(tmpDir, 'soflia_search_results.json');

    // Key fix: normalize the FILENAME too (strip accents) before comparing
    // This ensures "Pólizas" → "Polizas" matches search "polizas"
    // Also support multi-word: ALL words must appear in the normalized filename
    const wordsArrayPS = searchWords.map(w => `"${w}"`).join(', ');

    const psScript = `
$results = @()
$searchWords = @(${wordsArrayPS})
$searchFull = "${noAccents}"
$items = Get-ChildItem -Path "${home}" -Recurse -Depth 8 -ErrorAction SilentlyContinue
foreach ($item in $items) {
  if (-not $item.PSIsContainer) {
    # Normalize filename: strip accents + lowercase
    $normalized = $item.Name.Normalize([System.Text.NormalizationForm]::FormD)
    $normalized = [regex]::Replace($normalized, '[\\u0300-\\u036f]', '')
    $normalizedLower = $normalized.ToLower()

    # Match: either full string match OR all individual words appear
    $matchFull = $normalizedLower -like "*$searchFull*"
    $matchWords = $true
    if (-not $matchFull -and $searchWords.Count -gt 1) {
      foreach ($w in $searchWords) {
        if ($normalizedLower -notlike "*$w*") { $matchWords = $false; break }
      }
    } elseif (-not $matchFull) {
      $matchWords = $false
    }

    if ($matchFull -or $matchWords) {
      $results += [PSCustomObject]@{ FullName = $item.FullName; Length = $item.Length }
      if ($results.Count -ge 20) { break }
    }
  }
}
$results | ConvertTo-Json -Compress | Out-File -FilePath "${outputPath}" -Encoding utf8
`;

    await fs.writeFile(scriptPath, psScript, 'utf-8');

    await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      timeout: 45000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    let jsonOutput = '';
    try {
      jsonOutput = await fs.readFile(outputPath, 'utf-8');
    } catch { /* file might not exist if no results */ }

    fs.unlink(scriptPath).catch(() => {});
    fs.unlink(outputPath).catch(() => {});

    if (jsonOutput.trim()) {
      let parsed = JSON.parse(jsonOutput.trim());
      if (!Array.isArray(parsed)) parsed = [parsed];
      for (const item of parsed) {
        if (item.FullName) {
          addResult(item.FullName, item.Length || 0);
          console.log(`[smart_find_file] Found (PS): ${path.basename(item.FullName)} → ${item.FullName}`);
        }
      }
    }
  } catch (err: any) {
    console.error('[smart_find_file] PowerShell error:', err.message);
  }

  // ── Strategy 2: Windows Search Index (ADODB) — finds OneDrive cloud-only files ──
  if (results.length === 0) {
    console.log('[smart_find_file] Trying Windows Search Index...');
    try {
      const tmpDir = app.getPath('temp');
      const idxScriptPath = path.join(tmpDir, 'soflia_index_search.ps1');
      const idxOutputPath = path.join(tmpDir, 'soflia_index_results.json');

      // Use CONTAINS for word-based search OR LIKE for partial match
      // Windows Search Index handles accents natively
      const homeUrl = home.replace(/\\/g, '/');
      const likeClause = `System.FileName LIKE '%${noAccents}%'`;

      const idxScript = `
$ErrorActionPreference = 'SilentlyContinue'
$results = @()
try {
  $conn = New-Object -ComObject ADODB.Connection
  $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
  $sql = "SELECT System.ItemPathDisplay, System.Size FROM SystemIndex WHERE ${likeClause} AND scope='file:${homeUrl}'"
  $rs = $conn.Execute($sql)
  while (-not $rs.EOF) {
    $fp = $rs.Fields.Item("System.ItemPathDisplay").Value
    $sz = $rs.Fields.Item("System.Size").Value
    if ($fp) {
      $results += [PSCustomObject]@{ FullName = $fp; Length = if ($sz) { $sz } else { 0 } }
      if ($results.Count -ge 20) { break }
    }
    $rs.MoveNext()
  }
  $rs.Close()
  $conn.Close()
} catch { }
$results | ConvertTo-Json -Compress | Out-File -FilePath "${idxOutputPath}" -Encoding utf8
`;

      await fs.writeFile(idxScriptPath, idxScript, 'utf-8');

      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${idxScriptPath}"`, {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });

      let idxJson = '';
      try {
        idxJson = await fs.readFile(idxOutputPath, 'utf-8');
      } catch { /* no results file */ }

      fs.unlink(idxScriptPath).catch(() => {});
      fs.unlink(idxOutputPath).catch(() => {});

      if (idxJson.trim()) {
        let parsed = JSON.parse(idxJson.trim());
        if (!Array.isArray(parsed)) parsed = [parsed];
        for (const item of parsed) {
          if (item.FullName) {
            addResult(item.FullName, item.Length || 0);
            console.log(`[smart_find_file] Found (Index): ${path.basename(item.FullName)} → ${item.FullName}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[smart_find_file] Search Index error:', err.message);
    }
  }

  console.log(`[smart_find_file] Total results: ${results.length}`);
  return { success: true, results, query: filename };
}

// ─── Web tools implementation ───────────────────────────────────────
async function webSearch(query: string): Promise<{ success: boolean; results?: string; error?: string }> {
  try {
    // Try DuckDuckGo HTML for more scraper-friendly results
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!resp.ok) {
      // Fallback to Google if DDG fails
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8&hl=es`;
      const gResp = await fetch(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const html = await gResp.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { success: true, results: text.slice(0, 5000) };
    }

    const html = await resp.text();
    // Extract snippets from DDG
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return { success: true, results: text.slice(0, 6000) };
  } catch (err: any) {
    return { success: false, error: `Error buscando en la web: ${err.message}` };
  }
}

async function readWebpage(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(20000), // Increased timeout
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    
    const html = await resp.text();
    // More aggressive cleanup for better AI readability
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
      
    return { success: true, content: text.slice(0, 8000) }; // Extended context
  } catch (err: any) {
    return { success: false, error: `Error leyendo la página: ${err.message}` };
  }
}

// ─── Computer Use: mouse, keyboard, screenshot ──────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function takeScreenshotBase64(fullRes = false): Promise<string> {
  // Use lower resolution for vision API calls to avoid fetch failures with large payloads
  const size = fullRes
    ? { width: 1920, height: 1080 }
    : { width: 1280, height: 720 };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: size,
  });
  if (sources.length === 0) throw new Error('No screen found');
  const dataUrl = sources[0].thumbnail.toDataURL();
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

async function takeScreenshotToFile(): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
  });
  if (sources.length === 0) throw new Error('No screen found');
  const pngBuffer = sources[0].thumbnail.toPNG();
  const tmpPath = path.join(app.getPath('temp'), `soflia_screenshot_${Date.now()}.png`);
  await fs.writeFile(tmpPath, pngBuffer);
  return tmpPath;
}

async function mouseClick(x: number, y: number): Promise<void> {
  const script = `
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W
[W.U]::SetCursorPos(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 80
[W.U]::mouse_event(2,0,0,0,0)
Start-Sleep -Milliseconds 30
[W.U]::mouse_event(4,0,0,0,0)
`;
  await execAsync(`powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`, {
    timeout: 5000, windowsHide: true,
  });
}

async function mouseDoubleClick(x: number, y: number): Promise<void> {
  await mouseClick(x, y);
  await delay(80);
  await mouseClick(x, y);
}

async function keyboardType(text: string): Promise<void> {
  // Use clipboard for reliable text input (handles Unicode, special chars)
  const savedClip = clipboard.readText();
  clipboard.writeText(text);
  await delay(50);
  // Ctrl+V to paste
  await execAsync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`, {
    timeout: 5000, windowsHide: true,
  });
  await delay(100);
  // Restore clipboard
  clipboard.writeText(savedClip);
}

async function keyboardKey(key: string): Promise<void> {
  const keyMap: Record<string, string> = {
    'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}', 'esc': '{ESC}',
    'backspace': '{BACKSPACE}', 'delete': '{DELETE}', 'space': ' ',
    'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
    'home': '{HOME}', 'end': '{END}', 'pageup': '{PGUP}', 'pagedown': '{PGDN}',
    'ctrl+a': '^a', 'ctrl+c': '^c', 'ctrl+v': '^v', 'ctrl+s': '^s',
    'ctrl+z': '^z', 'ctrl+enter': '^{ENTER}', 'ctrl+w': '^w',
    'alt+f4': '%{F4}', 'alt+tab': '%{TAB}',
    'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}', 'f5': '{F5}',
  };
  const sendKey = keyMap[key.toLowerCase()] || key;
  await execAsync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')"`, {
    timeout: 5000, windowsHide: true,
  });
}

async function mouseScroll(direction: 'up' | 'down', amount: number = 3): Promise<void> {
  const delta = direction === 'up' ? 120 * amount : -120 * amount;
  await execAsync(`powershell -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -Name U -Namespace W; [W.U]::mouse_event(0x0800,0,0,${delta},0)"`, {
    timeout: 5000, windowsHide: true,
  });
}

// ─── Computer Use: autonomous vision loop ────────────────────────────
async function executeComputerUse(task: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: WA_MODEL });

  const MAX_STEPS = 15;
  let lastMessage = '';

  console.log(`[ComputerUse] Starting task: "${task}"`);

  for (let step = 0; step < MAX_STEPS; step++) {
    // 1. Take screenshot
    let screenshotBase64: string;
    try {
      screenshotBase64 = await takeScreenshotBase64();
    } catch (err: any) {
      console.error(`[ComputerUse] Screenshot failed:`, err.message);
      return `Error al capturar pantalla: ${err.message}`;
    }

    // 2. Send to Gemini with vision
    const prompt = step === 0
      ? `TAREA: ${task}

Analiza la captura de pantalla y decide qué acción tomar para completar la tarea.

Responde SOLO con un JSON válido (sin markdown, sin backticks):
{
  "action": "click" | "double_click" | "type" | "key" | "scroll" | "wait" | "done",
  "x": number (coordenada X para click),
  "y": number (coordenada Y para click),
  "text": "texto a escribir" (para type),
  "key": "enter|tab|escape|ctrl+s|ctrl+enter|etc" (para key),
  "direction": "up|down" (para scroll),
  "message": "descripción de lo que hiciste o resultado final"
}

Si la tarea ya está completada, usa "done" y explica el resultado en "message".`
      : `TAREA: ${task}

Paso anterior: ${lastMessage}
Paso ${step + 1} de máximo ${MAX_STEPS}.

Analiza la captura de pantalla actual y decide la siguiente acción.

Responde SOLO con JSON válido (sin markdown, sin backticks):
{
  "action": "click" | "double_click" | "type" | "key" | "scroll" | "wait" | "done",
  "x": number, "y": number,
  "text": "...",
  "key": "...",
  "direction": "up|down",
  "message": "..."
}`;

    let actionJson: any;
    // Retry up to 2 times on fetch/network errors
    let visionSuccess = false;
    for (let retry = 0; retry < 2; retry++) {
      try {
        const result = await model.generateContent([
          { inlineData: { mimeType: 'image/png', data: screenshotBase64 } },
          { text: prompt },
        ]);

        const responseText = result.response.text().trim();
        const jsonStr = responseText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        actionJson = JSON.parse(jsonStr);
        console.log(`[ComputerUse] Step ${step + 1}: ${actionJson.action} - ${actionJson.message || ''}`);
        visionSuccess = true;
        break;
      } catch (err: any) {
        console.error(`[ComputerUse] Vision/parse error (attempt ${retry + 1}):`, err.message);
        if (retry === 0) {
          await delay(2000); // Wait before retry
          continue;
        }
      }
    }
    if (!visionSuccess) {
      if (step > 0) return `Completé ${step} pasos pero hubo un error al analizar la pantalla.`;
      return `Error al analizar la pantalla. Intenta de nuevo.`;
    }

    // 3. Execute action
    try {
      switch (actionJson.action) {
        case 'click':
          await mouseClick(actionJson.x, actionJson.y);
          lastMessage = `Hice click en (${actionJson.x}, ${actionJson.y}). ${actionJson.message || ''}`;
          break;

        case 'double_click':
          await mouseDoubleClick(actionJson.x, actionJson.y);
          lastMessage = `Doble click en (${actionJson.x}, ${actionJson.y}). ${actionJson.message || ''}`;
          break;

        case 'type':
          await keyboardType(actionJson.text);
          lastMessage = `Escribí: "${actionJson.text}". ${actionJson.message || ''}`;
          break;

        case 'key':
          await keyboardKey(actionJson.key);
          lastMessage = `Presioné: ${actionJson.key}. ${actionJson.message || ''}`;
          break;

        case 'scroll':
          await mouseScroll(actionJson.direction || 'down', 3);
          lastMessage = `Scroll ${actionJson.direction || 'down'}. ${actionJson.message || ''}`;
          break;

        case 'wait':
          await delay(2000);
          lastMessage = `Esperando... ${actionJson.message || ''}`;
          break;

        case 'done':
          console.log(`[ComputerUse] Task completed: ${actionJson.message}`);
          return actionJson.message || 'Tarea completada en la computadora.';

        default:
          lastMessage = `Acción desconocida: ${actionJson.action}`;
      }
    } catch (err: any) {
      console.error(`[ComputerUse] Action error:`, err.message);
      lastMessage = `Error ejecutando ${actionJson.action}: ${err.message}`;
    }

    // 4. Wait for UI to update
    await delay(1500);
  }

  return `Completé ${MAX_STEPS} pasos de uso de computadora. ${lastMessage}`;
}

// ─── Post-process: strip markdown formatting for WhatsApp ───────────
const formatForWhatsApp = (text: string, isGroup: boolean = false): string => {
  let result = text;

  // Add group identity header like OpenClaw/Shelldon
  if (isGroup) {
    result = `[✨ *SofLIA*]: ${result}`;
  }

  // Remove markdown headers (## Title → *Title*)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  // Convert **bold** to *bold* (WhatsApp style)
  result = result.replace(/\*\*(.*?)\*\*/g, '*$1*');
  // Remove code blocks (```lang ... ```)
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').trim();
  });
  // Remove inline code backticks
  result = result.replace(/`([^`]+)`/g, '$1');
  // Convert markdown bold **text** to WhatsApp bold *text*
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  // Remove markdown links [text](url) → text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove markdown bullet dashes at start of line → use simple format
  result = result.replace(/^\s*[-•]\s+/gm, '• ');
  // Collapse 3+ newlines into 2
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}

export class WhatsAppAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private waService: WhatsAppService;
  private apiKey: string;
  private calendarService: CalendarService | null = null;
  private gmailService: GmailService | null = null;
  private driveService: DriveService | null = null;
  private gchatService: GChatService | null = null;
  private autoDevService: AutoDevService | null = null;
  private memory: MemoryService;
  private knowledge: KnowledgeService;

  constructor(waService: WhatsAppService, apiKey: string, memoryService: MemoryService, knowledgeService: KnowledgeService) {
    this.waService = waService;
    this.apiKey = apiKey;
    this.memory = memoryService;
    this.knowledge = knowledgeService;
  }

  setGoogleServices(calendar: CalendarService, gmail: GmailService, drive: DriveService, gchat?: GChatService): void {
    this.calendarService = calendar;
    this.gmailService = gmail;
    this.driveService = drive;
    this.gchatService = gchat || null;
    console.log('[WhatsApp Agent] Google services connected (Calendar, Gmail, Drive, Chat)');
  }

  setAutoDevService(service: AutoDevService): void {
    this.autoDevService = service;
    console.log('[WhatsApp Agent] AutoDev service connected');
  }

  updateApiKey(key: string) {
    this.apiKey = key;
    this.genAI = null;
  }

  public getGenAI(): GoogleGenerativeAI {
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }

  // ─── Handle text messages ───────────────────────────────────────
  async handleMessage(
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
    
    // Check for active workflow
    if (WorkflowManager.isActive(sessionKey)) {
      await WorkflowManager.handleMessage(sessionKey, text);
      return;
    }

    // Check for pending confirmation response
    const pending = pendingConfirmations.get(senderNumber);
    if (pending) {
      const lower = text.toLowerCase().trim();
      const confirmed = lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
      clearTimeout(pending.timeout);
      pendingConfirmations.delete(senderNumber);
      pending.resolve(confirmed);
      return;
    }

    // ─── Chat commands (inspired by OpenClaw) ────────────────────
    if (text.startsWith('/')) {
      const cmdResult = await this.handleChatCommand(jid, senderNumber, text, isGroup);
      if (cmdResult) {
        await this.waService.sendText(jid, cmdResult);
        return;
      }
      // Si se activó un workflow durante el comando, detener el procesamiento normal
      if (WorkflowManager.isActive(sessionKey)) {
        return;
      }
    }

    try {
      const response = await this.runAgentLoop(jid, senderNumber, text, isGroup, groupPassiveHistory);
      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Error:', err);
      // Auto-reset conversation on error to prevent stuck loops
      const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
      conversations.delete(sessionKey);
      console.warn(`[WhatsApp Agent] Auto-reset conversation for ${sessionKey} after error`);
      await this.waService.sendText(jid, `Ocurrió un error. He reiniciado la conversación. Intenta de nuevo.`);
    }
  }

  // ─── Chat commands (/status, /reset, /activation, /help) ────────
  private async handleChatCommand(
    jid: string,
    senderNumber: string,
    text: string,
    isGroup: boolean,
  ): Promise<string | null> {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;

    switch (cmd) {
      case '/status':
        return `🤖 *SofLIA activa*\n• Modelo: Gemini 2.5 Flash\n• Modo: ${isGroup ? 'Grupo' : 'DM'}\n• Historial: ${conversations.get(sessionKey)?.length || 0} mensajes`;

      case '/reset':
      case '/new':
        conversations.delete(sessionKey);
        this.memory.clearSessionContext(sessionKey);
        return '🔄 Conversación reiniciada.';

      case '/activation':
        if (!isGroup) return '⚠️ Este comando solo funciona en grupos.';
        // Security: Only administrator can change activation mode
        if (!this.waService.isAllowedNumber(senderNumber)) {
          return '❌ Solo el administrador puede cambiar el modo de activación.';
        }
        const mode = args[0]?.toLowerCase();
        if (mode === 'mention' || mode === 'always') {
          await this.waService.setGroupConfig({ groupActivation: mode });
          return `✅ Activación cambiada a: *${mode}*\n${mode === 'mention' ? '• Solo responderé cuando me mencionen, usen /soflia, o hagan reply a mi mensaje' : '• Responderé a TODOS los mensajes del grupo'}`;
        }
        return '📋 Uso: /activation mention | always';

      case '/presentación':
      case '/presentacion':
        await WorkflowManager.startWorkflow(sessionKey, jid, senderNumber, this.waService, this);
        return null;

      case '/help':
        return `📋 *Comandos disponibles:*\n\n/status — Estado de SofLIA\n/reset — Reiniciar conversación\n/new — Igual que /reset\n${isGroup ? '/activation mention|always — Modo de activación en grupo (Solo Admin)\n' : ''}/help — Esta ayuda\n\n${isGroup ? '💡 En grupos, solo respondo si me etiquetas (@SofLIA), usas el prefijo /soflia, o incluyes mi nombre "soflia" en tu mensaje.' : ''}`;

      default:
        // Not a recognized command, return null to let agent process it
        return null;
    }
  }

  // ─── Handle media (Photos, Docs) — FULL AGENTIC PIPELINE ─────
  async handleMedia(
    jid: string,
    senderNumber: string,
    buffer: Buffer,
    fileName: string,
    mimetype: string,
    text: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    try {
      // Build the user message that describes the media context
      const userText = text && text.trim()
        ? text.trim()
        : `[El usuario envió un archivo: ${fileName} (${mimetype}). Analízalo y responde.]`;

      // Prepare the image/media inline data for the agentic loop
      const base64Data = buffer.toString('base64');
      const imagePart = {
        inlineData: {
          mimeType: mimetype,
          data: base64Data,
        },
      };

      console.log(`[WhatsApp Agent] Processing media: ${fileName} (${mimetype}), caption: "${text?.slice(0, 60) || 'none'}"`);

      // Run the FULL agentic loop with the image as multimodal content
      const response = await this.runAgentLoop(
        jid,
        senderNumber,
        userText,
        isGroup,
        groupPassiveHistory,
        [imagePart],  // Pass image as inline data part
      );

      if (response) {
        await this.waService.sendText(jid, response);
      }
    } catch (err: any) {
      console.error('[WhatsApp Agent] Media error:', err);
      await this.waService.sendText(jid, 'No pude procesar el archivo. Intenta de nuevo o envía un mensaje de texto.');
    }
  }

  // ─── Handle audio messages ──────────────────────────────────────
  async handleAudio(
    jid: string,
    senderNumber: string,
    audioBuffer: Buffer,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
  ): Promise<void> {
    try {
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || !transcription.trim()) {
        await this.waService.sendText(jid, 'No pude entender el audio. ¿Podrías repetirlo o escribirlo?');
        return;
      }

      console.log(`[WhatsApp Agent] Audio transcribed: "${transcription}"`);
      await this.handleMessage(jid, senderNumber, transcription, isGroup, groupPassiveHistory);
    } catch (err: any) {
      console.error('[WhatsApp Agent] Audio error:', err);
      await this.waService.sendText(jid, 'No pude procesar el audio. Intenta enviar un mensaje de texto.');
    }
  }

  // ─── Transcribe audio with Gemini ───────────────────────────────
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const ai = this.getGenAI();
    const model = ai.getGenerativeModel({ model: WA_MODEL });

    const base64Audio = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: base64Audio,
        },
      },
      'Transcribe este audio a texto. Solo devuelve la transcripción exacta de lo que dice la persona, sin agregar nada más. Si no puedes entenderlo, responde con una cadena vacía.',
    ]);

    return result.response.text().trim();
  }

  // ─── Agentic loop ──────────────────────────────────────────────
  private async runAgentLoop(
    jid: string,
    senderNumber: string,
    userMessage: string,
    isGroup: boolean = false,
    groupPassiveHistory: string = '',
    inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }> = [],
  ): Promise<string> {
    const ai = this.getGenAI();

    // ─── Assemble 3-layer memory context ──────────────────────────
    const sessionKey = isGroup ? `group:${jid}:${senderNumber}` : senderNumber;
    let memoryContextStr = '';
    try {
      const memCtx = await this.memory.assembleContext(sessionKey, senderNumber, userMessage);
      memoryContextStr = this.memory.formatContextForPrompt(memCtx);
    } catch (err: any) {
      console.warn('[WhatsApp Agent] Memory context assembly failed:', err.message);
    }

    // Persist the incoming user message
    this.memory.saveMessage({
      sessionKey,
      phoneNumber: senderNumber,
      groupJid: isGroup ? jid : undefined,
      role: 'user',
      content: userMessage,
    });

    // ─── Inject OpenClaw-style knowledge files ─────────────────────
    const knowledgeContext = this.knowledge.getBootstrapContext(senderNumber);

    let systemPrompt = await buildSystemPrompt(memoryContextStr + knowledgeContext);

    // ─── Log Google services state for debugging ─────────────────
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const googleConn = conns.find((c: any) => c.provider === 'google');
      console.log(`[WhatsApp Agent] Google connection state: ${googleConn ? `active=${googleConn.isActive}, email=${googleConn.email}` : 'NOT CONNECTED'}`);
    } else {
      console.warn('[WhatsApp Agent] calendarService is null — Google APIs unavailable');
    }

    // ─── Inject Google connection status into system prompt ──────
    if (this.calendarService) {
      const conns = this.calendarService.getConnections();
      const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
      if (!hasGoogle) {
        systemPrompt += `\n\n═══ ESTADO DE CONEXIÓN GOOGLE ═══\n⚠️ Google NO está conectado. Si el usuario pide acciones de Calendar, Gmail, eventos o Drive, infórmale EXPRESAMENTE que debe conectar Google desde la interfaz de SofLIA Hub primero. \n❌ PROHIBICIONES ESTRICTAS: NO INTENTES USAR las herramientas de computadora (use_computer, execute_command, open_application) NI el navegador (open_url) para entrar a leer sus correos o ver su calendario. Si no tienes la API de Google conectada, debes NEGARTE a revisar el calendario o correos y guiarlos a conectarse desde cero.`;
      }
    }

    // ─── Group context injection ────────────────────────────────
    if (isGroup) {
      systemPrompt += `\n\n═══ CONTEXTO DE GRUPO ═══
Estás respondiendo en un GRUPO de WhatsApp.
• Solo respondes cuando te mencionan, usan /soflia, o hacen reply a tu mensaje
• Sé más conciso que en conversaciones 1:1
• No ejecutes acciones destructivas — tus herramientas de sistema están limitadas en grupos
• El participante que envió el mensaje es: ${senderNumber}
• Puedes usar: búsquedas web, lectura de páginas, consultas IRIS, crear documentos, enviar archivos

HISTORIAL RECIENTE DEL GRUPO (PARA CONTEXTO):
${groupPassiveHistory || 'No hay mensajes previos en el búfer.'}
`;
    }

    // ─── IRIS auto-auth by phone number ────────────────────────────
    let session = getWhatsAppSession(senderNumber);
    if (!session && isIrisAvailable()) {
      try {
        const autoAuth = await tryAutoAuthByPhone(senderNumber);
        if (autoAuth.success && autoAuth.session) {
          session = autoAuth.session;
          console.log(`[WhatsApp Agent] Auto-auth success: ${session.fullName} (${session.email})`);
        }
      } catch (err) {
        console.error('[WhatsApp Agent] Auto-auth error:', err);
      }
    }

    // ─── IRIS context injection ──────────────────────────────────
    if (session) {
      systemPrompt += `\n\n═══ SESIÓN PROJECT HUB ═══\nUsuario autenticado: ${session.fullName} (${session.email})\nUser ID: ${session.userId}\nEquipos: ${session.teamIds.length > 0 ? session.teamIds.join(', ') : 'ninguno encontrado'}\nPuede consultar sus tareas, proyectos y equipos directamente.\n${session.autoDetected ? 'Nota: El usuario fue identificado automáticamente por su número de WhatsApp.' : ''}`;
    } else if (isIrisAvailable()) {
      systemPrompt += `\n\n═══ PROJECT HUB ═══\nEl sistema IRIS (Project Hub) está disponible. El usuario NO ha iniciado sesión y su número de WhatsApp no está registrado en el sistema. Si pregunta por sus tareas, proyectos o equipos, indícale que debe autenticarse enviando su email y contraseña (o registrar su número de teléfono en su perfil de SofLIA Learning para acceso automático).`;
    }

    // If message mentions IRIS topics AND user is authenticated, inject data context
    if (session && needsIrisData(userMessage)) {
      try {
        const irisContext = await buildIrisContextForWhatsApp(session.userId);
        if (irisContext) {
          systemPrompt += `\n\n${irisContext}`;
        }
      } catch (err) {
        console.error('[WhatsApp Agent] Error fetching IRIS context:', err);
      }
    }

    // ─── Filter tools for group context ──────────────────────────
    const toolDeclarations = isGroup
      ? {
          functionDeclarations: (WA_TOOL_DECLARATIONS as any).functionDeclarations.filter(
            (t: any) => !GROUP_BLOCKED_TOOLS.has(t.name)
          ),
        }
      : WA_TOOL_DECLARATIONS;

    const model = ai.getGenerativeModel({
      model: WA_MODEL,
      systemInstruction: systemPrompt,
      tools: [toolDeclarations as any],
    });

    // Get or create conversation history (only clean user/model text pairs)
    if (!conversations.has(sessionKey)) {
      conversations.set(sessionKey, []);
    }
    const history = conversations.get(sessionKey)!;

    // Validate history: ensure it alternates user/model and contains only text parts
    const cleanHistory: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const entry of history) {
      // Skip entries with non-text parts or empty parts
      const textParts = entry.parts.filter(p => typeof p.text === 'string' && p.text.trim());
      if (textParts.length === 0) continue;
      // Ensure alternating roles
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === entry.role) {
        // Merge consecutive same-role entries
        cleanHistory[cleanHistory.length - 1].parts.push(...textParts);
      } else {
        cleanHistory.push({ role: entry.role, parts: textParts.map(p => ({ text: p.text })) });
      }
    }
    // Ensure starts with user
    while (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
      cleanHistory.shift();
    }
    // Ensure ends with model (required by Gemini for history)
    while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
      cleanHistory.pop();
    }

    // Pass a COPY to startChat — the SDK mutates the array in-place
    const historyCopy = cleanHistory.map(h => ({ role: h.role, parts: [...h.parts] }));

    let chatSession;
    try {
      chatSession = model.startChat({
        history: historyCopy,
        generationConfig: { maxOutputTokens: 4096 },
      });
    } catch (historyErr: any) {
      // If history is corrupted, reset and retry with empty history
      console.warn(`[WhatsApp Agent] Corrupted history for ${sessionKey}, resetting:`, historyErr.message);
      conversations.delete(sessionKey);
      conversations.set(sessionKey, []);
      chatSession = model.startChat({
        history: [],
        generationConfig: { maxOutputTokens: 4096 },
      });
    }

    // Build message parts: if we have inline media (images, docs), include them
    const messageParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [];
    if (inlineMediaParts.length > 0) {
      messageParts.push(...inlineMediaParts);
      messageParts.push(userMessage);
    }

    let response;
    try {
      response = await chatSession.sendMessage(
        inlineMediaParts.length > 0 ? messageParts : userMessage
      );
    } catch (sendErr: any) {
      console.error(`[WhatsApp Agent] sendMessage error: ${sendErr.message}`);
      // If the error is related to history, retry with empty history
      if (sendErr.message?.includes('history') || sendErr.message?.includes('content') || sendErr.message?.includes('400')) {
        console.warn(`[WhatsApp Agent] Retrying with empty history for ${sessionKey}`);
        conversations.delete(sessionKey);
        conversations.set(sessionKey, []);
        const freshSession = model.startChat({
          history: [],
          generationConfig: { maxOutputTokens: 4096 },
        });
        response = await freshSession.sendMessage(
          inlineMediaParts.length > 0 ? messageParts : userMessage
        );
      } else {
        throw sendErr;
      }
    }
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const candidate = response.response.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);

      // Log for debugging
      if (!candidate || parts.length === 0) {
        console.warn(`[WhatsApp Agent] Empty response from model. finishReason: ${finishReason}, candidates: ${response.response.candidates?.length || 0}`);
        // Check for prompt feedback (safety blocks)
        const feedback = (response.response as any).promptFeedback;
        if (feedback) {
          console.warn(`[WhatsApp Agent] Prompt feedback:`, JSON.stringify(feedback));
        }
      }

      if (functionCalls.length === 0) {
        // Final text response
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const finalText = textParts.join('');

        // Update our clean history (only user/model text — no function roles)
        history.push({ role: 'user', parts: [{ text: userMessage }] });
        history.push({ role: 'model', parts: [{ text: finalText }] });

        // Persist model response to 3-layer memory
        if (finalText.trim()) {
          this.memory.saveMessage({
            sessionKey,
            phoneNumber: senderNumber,
            groupJid: isGroup ? jid : undefined,
            role: 'model',
            content: finalText,
          });
        }

        // Trim history
        while (history.length > MAX_HISTORY * 2) {
          history.shift();
        }
        // Ensure starts with user
        while (history.length > 0 && history[0].role === 'model') {
          history.shift();
        }

        // If the response was blocked or errored, provide useful feedback
        if (!finalText.trim() && finishReason && finishReason !== 'STOP') {
          console.error(`[WhatsApp Agent] Model returned empty text with finishReason: ${finishReason}`);
          return formatForWhatsApp('Hubo un problema procesando tu solicitud. Intenta reformular tu mensaje.', isGroup);
        }

        // If empty text with STOP, check Google connection and provide contextual help
        if (!finalText.trim()) {
          console.warn(`[WhatsApp Agent] Empty text response for message: "${userMessage.slice(0, 80)}". finishReason: ${finishReason}, iterations: ${iterations}`);

          // Check if user message was about Google services and connection is missing
          const googleKeywords = /drive|calendar|calendario|agenda|evento|gmail|email|correo/i;
          if (googleKeywords.test(userMessage) && this.calendarService) {
            const conns = this.calendarService.getConnections();
            const hasGoogle = conns.some((c: any) => c.provider === 'google' && c.isActive);
            if (!hasGoogle) {
              return formatForWhatsApp('No tengo acceso a tu cuenta de Google. Necesitas conectar Google desde SofLIA Hub (sección Calendario) para que pueda usar Drive, Calendar y Gmail.', isGroup);
            }
          }
        }

        const finalResponse = finalText.trim() || '¿En qué puedo ayudarte?';
        return formatForWhatsApp(finalResponse, isGroup);
      }

      // Execute function calls
      const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const toolName: string = fc.name;
        const toolArgs: Record<string, any> = fc.args || {};

        // Security: Block disallowed tools
        if (BLOCKED_TOOLS_WA.has(toolName)) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { success: false, error: 'Esta herramienta no está disponible por WhatsApp por seguridad.' },
            },
          });
          continue;
        }

        // Group Security: Block powerful tools in groups
        if (isGroup && GROUP_BLOCKED_TOOLS.has(toolName)) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { success: false, error: 'Esta herramienta no está permitida en grupos por seguridad.' },
            },
          });
          continue;
        }

        // Confirmation for dangerous tools (checked early, before handlers)
        if (CONFIRM_TOOLS_WA.has(toolName)) {
          let desc = '';
          switch (toolName) {
            case 'delete_item': desc = `🗑️ Eliminar: ${toolArgs.path}`; break;
            case 'send_email': desc = `📧 Enviar email a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`; break;
            case 'kill_process': desc = `⚠️ Cerrar proceso: ${toolArgs.name || `PID ${toolArgs.pid}`}`; break;
            case 'lock_session': desc = '🔒 Bloquear sesión de Windows'; break;
            case 'shutdown_computer': desc = `⏻ Apagar computadora (en ${toolArgs.delay_seconds || 60}s)`; break;
            case 'restart_computer': desc = `🔄 Reiniciar computadora (en ${toolArgs.delay_seconds || 60}s)`; break;
            case 'sleep_computer': desc = '😴 Suspender computadora'; break;
            case 'toggle_wifi': desc = toolArgs.enable ? '📶 Activar Wi-Fi' : '📵 Desactivar Wi-Fi'; break;
            case 'execute_command': desc = `💻 Ejecutar comando: ${toolArgs.command}`; break;
            case 'open_application': desc = `🚀 Abrir aplicación: ${toolArgs.path}`; break;
            case 'run_in_terminal': desc = `🖥️ Abrir terminal y ejecutar: ${toolArgs.command}${toolArgs.working_directory ? `\nEn: ${toolArgs.working_directory}` : ''}`; break;
            case 'run_claude_code': desc = `🤖 Lanzar Claude Code: "${toolArgs.task}"${toolArgs.project_directory ? `\nEn: ${toolArgs.project_directory}` : ''}`; break;
            case 'whatsapp_send_to_contact': desc = `📱 Enviar a ${toolArgs.phone_number}: ${toolArgs.file_path ? path.basename(toolArgs.file_path) : toolArgs.message?.slice(0, 50) || 'mensaje'}`; break;
            case 'gmail_send': desc = `📧 Enviar email (Gmail) a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`; break;
            case 'gmail_trash': desc = `🗑️ Eliminar email: ${toolArgs.message_id}`; break;
            case 'google_calendar_delete': desc = `🗑️ Eliminar evento de Google Calendar: ${toolArgs.event_id}`; break;
            case 'gchat_send_message': desc = `💬 Enviar mensaje en Google Chat: ${toolArgs.text?.slice(0, 60)}`; break;
            case 'gchat_add_reaction': desc = `${toolArgs.emoji} Reacción en Google Chat`; break;
            default: desc = `${toolName}: ${JSON.stringify(toolArgs)}`;
          }

          const confirmed = await this.requestConfirmation(jid, senderNumber, toolName, desc, toolArgs);

          if (!confirmed) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, error: 'Acción cancelada por el usuario.' },
              },
            });
            continue;
          }
        }

        // Handle whatsapp_send_file specially
        if (toolName === 'whatsapp_send_file') {
          try {
            await this.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, message: `Archivo enviado por WhatsApp: ${toolArgs.file_path}` },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, error: err.message },
              },
            });
          }
          continue;
        }

        // Handle open_file_on_computer
        if (toolName === 'open_file_on_computer') {
          try {
            const errorMsg = await shell.openPath(toolArgs.file_path);
            if (errorMsg) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, error: errorMsg } },
              });
            } else {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: true, message: `Archivo abierto: ${path.basename(toolArgs.file_path)}` } },
              });
            }
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle take_screenshot_and_send — capture screen and send via WhatsApp
        if (toolName === 'take_screenshot_and_send') {
          try {
            const screenshotPath = await takeScreenshotToFile();
            await this.waService.sendFile(jid, screenshotPath, 'Captura de pantalla');
            // Cleanup temp file after sending
            setTimeout(() => fs.unlink(screenshotPath).catch(() => {}), 5000);
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: 'Captura de pantalla enviada por WhatsApp.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle use_computer — autonomous screenshot → vision → action loop
        if (toolName === 'use_computer') {
          try {
            const result = await executeComputerUse(toolArgs.task, this.apiKey);
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: result } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle create_calendar_event — creates .ics file and opens it
        if (toolName === 'create_calendar_event') {
          try {
            const title = toolArgs.title || 'Evento';
            const startStr = toolArgs.start_date; // "YYYY-MM-DDTHH:mm"
            const startDate = new Date(startStr);
            let endDate: Date;
            if (toolArgs.end_date) {
              endDate = new Date(toolArgs.end_date);
            } else {
              endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
            }
            const description = toolArgs.description || '';
            const location = toolArgs.location || '';

            // Format dates for ICS: YYYYMMDDTHHmmSS
            const fmtICS = (d: Date) => {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
            };

            const uid = `soflia-${Date.now()}@sofliaHub`;
            const now = fmtICS(new Date());

            const icsContent = [
              'BEGIN:VCALENDAR',
              'VERSION:2.0',
              'PRODID:-//SofLIA Hub//WhatsApp Agent//ES',
              'CALSCALE:GREGORIAN',
              'METHOD:PUBLISH',
              'BEGIN:VEVENT',
              `UID:${uid}`,
              `DTSTAMP:${now}`,
              `DTSTART:${fmtICS(startDate)}`,
              `DTEND:${fmtICS(endDate)}`,
              `SUMMARY:${title}`,
              description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
              location ? `LOCATION:${location}` : '',
              'STATUS:CONFIRMED',
              `BEGIN:VALARM`,
              `TRIGGER:-PT15M`,
              `ACTION:DISPLAY`,
              `DESCRIPTION:Recordatorio`,
              `END:VALARM`,
              'END:VEVENT',
              'END:VCALENDAR',
            ].filter(l => l).join('\r\n');

            const tmpDir = app.getPath('temp');
            const icsPath = path.join(tmpDir, `soflia_event_${Date.now()}.ics`);
            await fs.writeFile(icsPath, icsContent, 'utf-8');

            const openError = await shell.openPath(icsPath);
            if (openError) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, error: `No se pudo abrir el archivo ICS: ${openError}` } },
              });
            } else {
              // Format date for user-friendly response
              const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
              const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
              const dayName = dayNames[startDate.getDay()];
              const monthName = monthNames[startDate.getMonth()];
              const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: {
                    success: true,
                    message: `Evento creado y abierto en el calendario: "${title}" el ${dayName} ${startDate.getDate()} de ${monthName} de ${startDate.getFullYear()} a las ${timeStr}`,
                  },
                },
              });
            }

            // Cleanup after 10 seconds
            setTimeout(() => fs.unlink(icsPath).catch(() => {}), 10000);
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle smart_find_file
        if (toolName === 'smart_find_file') {
          const result = await smartFindFile(toolArgs.filename);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle web_search
        if (toolName === 'web_search') {
          const result = await webSearch(toolArgs.query);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle read_webpage
        if (toolName === 'read_webpage') {
          const result = await readWebpage(toolArgs.url);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // Handle save_lesson → persisted via MemoryService facts
        if (toolName === 'save_lesson') {
          try {
            const key = (toolArgs.lesson as string).slice(0, 60).replace(/[^a-zA-Z0-9áéíóúñ\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
            const result = this.memory.saveFact({
              phoneNumber: senderNumber,
              category: 'correction',
              key: key || `lesson_${Date.now()}`,
              value: toolArgs.lesson,
              context: toolArgs.context || 'Aprendido en conversación WhatsApp',
            });
            console.log(`[WhatsApp Agent] Lesson saved via MemoryService: "${toolArgs.lesson}"`);
            functionResponses.push({
              functionResponse: { name: toolName, response: result },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // Handle recall_memories → reads from MemoryService facts
        if (toolName === 'recall_memories') {
          try {
            const facts = this.memory.getFacts(senderNumber);
            const lessons = facts.filter(f => f.category === 'correction');
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: {
                  success: true,
                  memories: lessons.map(f => f.value),
                  count: lessons.length,
                  message: lessons.length === 0 ? 'No hay lecciones guardadas aún.' : undefined,
                },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── Knowledge Base Tools (OpenClaw-style .md files) ────────
        if (toolName === 'knowledge_save') {
          const result = this.knowledge.saveToMemory(toolArgs.content, toolArgs.section);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        if (toolName === 'knowledge_update_user') {
          const result = this.knowledge.updateUserProfile(senderNumber, toolArgs.section, toolArgs.content);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        if (toolName === 'knowledge_search') {
          const results = this.knowledge.searchKnowledge(toolArgs.query, 8);
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: {
                success: true,
                results,
                count: results.length,
                message: results.length === 0 ? 'No se encontraron resultados.' : undefined,
              },
            },
          });
          continue;
        }

        if (toolName === 'knowledge_log') {
          const result = this.knowledge.saveToDailyLog(toolArgs.content, senderNumber);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        if (toolName === 'knowledge_read') {
          const result = this.knowledge.readKnowledgeFile(toolArgs.file);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
          continue;
        }

        // ─── System Control Tools ───────────────────────────────────
        if (toolName === 'list_processes') {
          try {
            const sortBy = toolArgs.sort_by || 'memory';
            const top = toolArgs.top || 15;
            const sortCol = sortBy === 'cpu' ? 'CPU' : sortBy === 'name' ? 'ProcessName' : 'WorkingSet64';
            const { stdout } = await execAsync(
              `powershell -NoProfile -Command "Get-Process | Sort-Object ${sortCol} -Descending | Select-Object -First ${top} ProcessName, Id, @{N='CPU_s';E={[math]::Round($_.CPU,1)}}, @{N='Mem_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress"`,
              { timeout: 10000, windowsHide: true }
            );
            let processes = JSON.parse(stdout.trim());
            if (!Array.isArray(processes)) processes = [processes];
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, processes, count: processes.length },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'kill_process') {
          // Confirmation handled below in the CONFIRM_TOOLS_WA block
          // After confirmation, execute here
          try {
            if (toolArgs.pid) {
              await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${toolArgs.pid} -Force"`, { timeout: 10000, windowsHide: true });
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: true, message: `Proceso con PID ${toolArgs.pid} cerrado.` } },
              });
            } else if (toolArgs.name) {
              const procName = toolArgs.name.replace(/\.exe$/i, '');
              const { stdout } = await execAsync(
                `powershell -NoProfile -Command "(Get-Process -Name '${procName}' -ErrorAction SilentlyContinue).Count"`,
                { timeout: 10000, windowsHide: true }
              );
              const count = parseInt(stdout.trim()) || 0;
              if (count === 0) {
                functionResponses.push({
                  functionResponse: { name: toolName, response: { success: false, error: `No se encontró ningún proceso con nombre "${procName}".` } },
                });
              } else {
                await execAsync(`powershell -NoProfile -Command "Stop-Process -Name '${procName}' -Force"`, { timeout: 10000, windowsHide: true });
                functionResponses.push({
                  functionResponse: { name: toolName, response: { success: true, message: `${count} instancia(s) de "${procName}" cerrada(s).` } },
                });
              }
            } else {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, error: 'Debes especificar pid o name.' } },
              });
            }
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'lock_session') {
          try {
            await execAsync('rundll32.exe user32.dll,LockWorkStation', { timeout: 5000, windowsHide: true });
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: 'Sesión bloqueada.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'shutdown_computer') {
          try {
            const delay = toolArgs.delay_seconds || 60;
            await execAsync(`shutdown /s /t ${delay}`, { timeout: 5000, windowsHide: true });
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: `Apagado programado en ${delay} segundos. Usa cancel_shutdown para cancelar.` } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'restart_computer') {
          try {
            const delay = toolArgs.delay_seconds || 60;
            await execAsync(`shutdown /r /t ${delay}`, { timeout: 5000, windowsHide: true });
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: `Reinicio programado en ${delay} segundos. Usa cancel_shutdown para cancelar.` } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'sleep_computer') {
          try {
            await execAsync('powershell -NoProfile -Command "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"', { timeout: 5000, windowsHide: true });
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: 'Computadora en modo suspensión.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'cancel_shutdown') {
          try {
            await execAsync('shutdown /a', { timeout: 5000, windowsHide: true });
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: 'Apagado/reinicio cancelado.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'set_volume') {
          try {
            let psCmd = '';
            if (toolArgs.action === 'mute') {
              psCmd = `
$wsh = New-Object -ComObject WScript.Shell
$wsh.SendKeys([char]173)`;
            } else if (toolArgs.action === 'unmute') {
              psCmd = `
$wsh = New-Object -ComObject WScript.Shell
$wsh.SendKeys([char]173)`;
            } else if (toolArgs.action === 'up') {
              psCmd = `
$wsh = New-Object -ComObject WScript.Shell
1..5 | ForEach-Object { $wsh.SendKeys([char]175) }`;
            } else if (toolArgs.action === 'down') {
              psCmd = `
$wsh = New-Object -ComObject WScript.Shell
1..5 | ForEach-Object { $wsh.SendKeys([char]174) }`;
            } else if (toolArgs.level !== undefined) {
              // Set absolute volume using nircmd-style approach via PowerShell audio API
              const level = Math.max(0, Math.min(100, toolArgs.level));
              psCmd = `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _0(); int _1(); int _2(); int _3(); int _4(); int _5(); int _6(); int _7();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int _9();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int _11(); int _12();
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref System.Guid iid, int dwClsCtx, System.IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
'@
$de = New-Object MMDeviceEnumerator
$dev = $null
$de.GetDefaultAudioEndpoint(0, 1, [ref]$dev)
$iid = [Guid]"5CDF2C82-841E-4546-9722-0CF74078229A"
$epv = $null
$dev.Activate([ref]$iid, 1, [System.IntPtr]::Zero, [ref]$epv)
$vol = [IAudioEndpointVolume]$epv
$vol.SetMasterVolumeLevelScalar(${level / 100.0}, [Guid]::Empty)`;
            } else {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, error: 'Debes especificar level (0-100) o action (mute/unmute/up/down).' } },
              });
              continue;
            }
            await execAsync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 10000, windowsHide: true });
            const actionMsg = toolArgs.action
              ? (toolArgs.action === 'mute' ? 'Silenciado' : toolArgs.action === 'unmute' ? 'Desilenciado' : toolArgs.action === 'up' ? 'Volumen subido' : 'Volumen bajado')
              : `Volumen ajustado a ${toolArgs.level}%`;
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: actionMsg } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'toggle_wifi') {
          try {
            const action = toolArgs.enable ? 'enable' : 'disable';
            // Try common Wi-Fi interface names
            await execAsync(
              `powershell -NoProfile -Command "$adapter = Get-NetAdapter -Physical | Where-Object { $_.MediaType -eq '802.3' -or $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' -and $_.InterfaceDescription -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1; if (-not $adapter) { $adapter = Get-NetAdapter | Where-Object { $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1 }; if ($adapter) { ${action === 'enable' ? 'Enable-NetAdapter' : 'Disable-NetAdapter'} -Name $adapter.Name -Confirm:$false } else { throw 'No se encontró adaptador Wi-Fi' }"`,
              { timeout: 15000, windowsHide: true }
            );
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: toolArgs.enable ? 'Wi-Fi activado.' : 'Wi-Fi desactivado.' } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── run_in_terminal — Detached visible terminal ────────────
        if (toolName === 'run_in_terminal') {
          try {
            const workDir = toolArgs.working_directory || os.homedir();
            const keepOpen = toolArgs.keep_open !== false; // default true
            const noExitFlag = keepOpen ? '-NoExit' : '';
            const psArgs = [noExitFlag, '-Command', `Set-Location '${workDir.replace(/'/g, "''")}'; ${toolArgs.command}`].filter(Boolean);
            const child = spawn('powershell.exe', psArgs, {
              detached: true,
              stdio: 'ignore',
              windowsHide: false,
            });
            child.unref();
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: `Terminal abierta ejecutando: ${toolArgs.command}\nDirectorio: ${workDir}` } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── run_claude_code — Launch Claude Code with a task ────────
        if (toolName === 'run_claude_code') {
          try {
            let projectDir = toolArgs.project_directory || '';
            if (!projectDir) {
              // Try to find a common project directory
              const home = os.homedir();
              const desktopPath = path.join(home, 'Desktop');
              const oneDriveDesktop = path.join(home, 'OneDrive', 'Escritorio');
              try {
                await fs.access(oneDriveDesktop);
                projectDir = oneDriveDesktop;
              } catch {
                projectDir = desktopPath;
              }
            }
            // Escape single quotes in task for PowerShell
            const escapedTask = toolArgs.task.replace(/'/g, "''").replace(/"/g, '\\"');
            const psArgs = ['-NoExit', '-Command', `Set-Location '${projectDir.replace(/'/g, "''")}'; claude "${escapedTask}"`];
            const child = spawn('powershell.exe', psArgs, {
              detached: true,
              stdio: 'ignore',
              windowsHide: false,
            });
            child.unref();
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: true, message: `Claude Code lanzado con tarea: "${toolArgs.task}"\nDirectorio: ${projectDir}` } },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── whatsapp_send_to_contact — Send to another number ──────
        if (toolName === 'whatsapp_send_to_contact') {
          try {
            // Normalize phone number: remove spaces, dashes, +, parentheses
            const cleanNumber = toolArgs.phone_number.replace(/[\s\-\+\(\)]/g, '');
            const targetJid = `${cleanNumber}@s.whatsapp.net`;

            if (toolArgs.file_path) {
              await this.waService.sendFile(targetJid, toolArgs.file_path, toolArgs.caption || toolArgs.message);
            }
            if (toolArgs.message && !toolArgs.file_path) {
              await this.waService.sendText(targetJid, toolArgs.message);
            }
            // If both file and message, send message separately after file
            if (toolArgs.message && toolArgs.file_path) {
              await this.waService.sendText(targetJid, toolArgs.message);
            }

            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: {
                  success: true,
                  message: `Enviado a ${toolArgs.phone_number}: ${toolArgs.file_path ? 'archivo ' + path.basename(toolArgs.file_path) : ''}${toolArgs.message ? ' + mensaje' : ''}`,
                },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── create_document — Word/Excel creation ──────────────────
        if (toolName === 'create_document') {
          try {
            const docType = toolArgs.type?.toLowerCase();
            const filename = toolArgs.filename || 'documento';
            const title = toolArgs.title || filename;
            let saveDir = toolArgs.save_directory || '';

            if (!saveDir) {
              const home = os.homedir();
              const oneDriveDesktop = path.join(home, 'OneDrive', 'Escritorio');
              try {
                await fs.access(oneDriveDesktop);
                saveDir = oneDriveDesktop;
              } catch {
                saveDir = path.join(home, 'Desktop');
              }
            }

            if (docType === 'word' || docType === 'docx') {
              // ─── Create Word document using docx library ─────────
              const docxLib = await import('docx');
              const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxLib;

              const lines = toolArgs.content.split('\n');
              const paragraphs: any[] = [];

              for (const line of lines) {
                if (line.startsWith('## ')) {
                  paragraphs.push(new Paragraph({
                    text: line.replace('## ', ''),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 },
                  }));
                } else if (line.startsWith('# ')) {
                  paragraphs.push(new Paragraph({
                    text: line.replace('# ', ''),
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 360, after: 200 },
                  }));
                } else if (line.trim() === '') {
                  paragraphs.push(new Paragraph({ text: '' }));
                } else {
                  // Handle *bold* markers
                  const parts: any[] = [];
                  const regex = /\*([^*]+)\*/g;
                  let lastIdx = 0;
                  let match;
                  while ((match = regex.exec(line)) !== null) {
                    if (match.index > lastIdx) {
                      parts.push(new TextRun({ text: line.slice(lastIdx, match.index) }));
                    }
                    parts.push(new TextRun({ text: match[1], bold: true }));
                    lastIdx = match.index + match[0].length;
                  }
                  if (lastIdx < line.length) {
                    parts.push(new TextRun({ text: line.slice(lastIdx) }));
                  }
                  if (parts.length === 0) {
                    parts.push(new TextRun({ text: line }));
                  }
                  paragraphs.push(new Paragraph({ children: parts, spacing: { after: 120 } }));
                }
              }

              // Add title as first element
              paragraphs.unshift(new Paragraph({
                text: title,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }));

              const doc = new Document({
                sections: [{ properties: {}, children: paragraphs }],
              });

              const buffer = await Packer.toBuffer(doc);
              const filePath = path.join(saveDir, `${filename}.docx`);
              await fs.writeFile(filePath, buffer);

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { success: true, file_path: filePath, message: `Documento Word creado: ${filePath}` },
                },
              });
            } else if (docType === 'excel' || docType === 'xlsx') {
              // ─── Create Excel document using exceljs ─────────────
              const ExcelJS = await import('exceljs');
              const workbook = new ExcelJS.default.Workbook();
              const sheet = workbook.addWorksheet(title.slice(0, 31)); // Excel max 31 chars

              let rows: any[];
              try {
                rows = JSON.parse(toolArgs.content);
              } catch {
                // If not valid JSON, create a simple single-column sheet
                rows = toolArgs.content.split('\n').filter((l: string) => l.trim()).map((l: string) => ({ Contenido: l }));
              }

              if (Array.isArray(rows) && rows.length > 0) {
                // Add headers from first row keys
                const headers = Object.keys(rows[0]);
                sheet.addRow(headers);
                // Style header row
                const headerRow = sheet.getRow(1);
                headerRow.font = { bold: true };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

                // Add data rows
                for (const row of rows) {
                  sheet.addRow(headers.map(h => row[h] ?? ''));
                }

                // Auto-fit columns
                for (const col of sheet.columns) {
                  let maxLen = 10;
                  col.eachCell?.({ includeEmpty: false }, (cell) => {
                    const len = cell.value ? cell.value.toString().length : 0;
                    if (len > maxLen) maxLen = len;
                  });
                  col.width = Math.min(maxLen + 2, 50);
                }
              }

              const filePath = path.join(saveDir, `${filename}.xlsx`);
              await workbook.xlsx.writeFile(filePath);

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { success: true, file_path: filePath, message: `Documento Excel creado: ${filePath}` },
                },
              });
            } else if (docType === 'md' || docType === 'markdown') {
              // ─── Create Markdown document ───────────────────────────
              const filePath = path.join(saveDir, `${filename}.md`);
              const mdContent = `# ${title}\n\n${toolArgs.content}`;
              await fs.writeFile(filePath, mdContent, 'utf-8');

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { success: true, file_path: filePath, message: `Documento Markdown creado: ${filePath}` },
                },
              });
            } else if (docType === 'pdf') {
              // ─── Create PDF document using Electron BrowserWindow ───
              const { BrowserWindow } = await import('electron');
              const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
              
              const htmlContent = toolArgs.content
                .replace(/## (.*?)\n/g, '<h2>$1</h2>\n')
                .replace(/# (.*?)\n/g, '<h1>$1</h1>\n')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br/>\n');

              const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                h1 { color: #111; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                h2 { color: #222; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                p { margin-bottom: 15px; }
                strong { font-weight: 600; color: #000; }
              </style></head><body><h1>${title}</h1>${htmlContent}</body></html>`;

              const filePath = path.join(saveDir, `${filename}.pdf`);
              
              await new Promise<void>((resolve, reject) => {
                win.webContents.on('did-finish-load', async () => {
                  try {
                    const data = await win.webContents.printToPDF({
                      printBackground: true
                    });
                    await fs.writeFile(filePath, data);
                    win.destroy();
                    resolve();
                  } catch (e) {
                    win.destroy();
                    reject(e);
                  }
                });
                win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
              });

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { success: true, file_path: filePath, message: `Documento PDF creado: ${filePath}` },
                },
              });
            } else {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, error: 'Tipo no válido. Usa "word", "excel", "pdf" o "md".' } },
              });
            }
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, error: err.message } },
            });
          }
          continue;
        }

        // ─── Google Calendar API Handlers ────────────────────────────
        if (toolName === 'google_calendar_create') {
          try {
            if (!this.calendarService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Calendar no está disponible. El usuario debe conectar Google en SofLIA Hub.' } } });
            } else {
              const startDate = new Date(toolArgs.start_date);
              const endDate = toolArgs.end_date ? new Date(toolArgs.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
              const result = await this.calendarService.createEvent({
                title: toolArgs.title,
                start: startDate,
                end: endDate,
                description: toolArgs.description,
                location: toolArgs.location,
              });
              if (result.success) {
                const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
                functionResponses.push({ functionResponse: { name: toolName, response: { success: true, eventId: result.eventId, message: `Evento creado en Google Calendar: "${toolArgs.title}" el ${dayNames[startDate.getDay()]} ${startDate.getDate()} de ${monthNames[startDate.getMonth()]} a las ${timeStr}` } } });
              } else {
                functionResponses.push({ functionResponse: { name: toolName, response: result } });
              }
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'google_calendar_get_events') {
          try {
            if (!this.calendarService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Calendar no conectado.' } } });
            } else {
              let start = new Date();
              start.setHours(0, 0, 0, 0);
              let end = new Date(start);
              end.setHours(23, 59, 59, 999);

              if (toolArgs.start_date) {
                start = new Date(toolArgs.start_date);
                end = new Date(start);
                end.setHours(23, 59, 59, 999); // Default end of that day
              }
              if (toolArgs.end_date) {
                end = new Date(toolArgs.end_date);
              }

              const events = await this.calendarService.getCurrentEvents(start);
              const formatted = events.map((e: any) => ({
                id: e.id,
                title: e.title,
                start: e.isAllDay ? e.start.toISOString().split('T')[0] : e.start.toLocaleString('es-MX'),
                end: e.isAllDay ? e.end.toISOString().split('T')[0] : e.end.toLocaleString('es-MX'),
                location: e.location || null,
                description: e.description || null,
                isAllDay: e.isAllDay,
              }));
              functionResponses.push({ functionResponse: { name: toolName, response: { success: true, request_range: { start: start.toLocaleString('es-MX'), end: end.toLocaleString('es-MX') }, events: formatted, count: formatted.length } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'google_calendar_delete') {
          try {
            if (!this.calendarService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Calendar no conectado.' } } });
            } else {
              const result = await this.calendarService.deleteEvent(toolArgs.event_id);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        // ─── Gmail API Handlers ──────────────────────────────────────
        if (toolName === 'gmail_send') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no está disponible. El usuario debe conectar Google en SofLIA Hub.' } } });
            } else {
              const toList = toolArgs.to.split(',').map((s: string) => s.trim());
              const ccList = toolArgs.cc ? toolArgs.cc.split(',').map((s: string) => s.trim()) : undefined;
              const result = await this.gmailService.sendEmail({
                to: toList,
                subject: toolArgs.subject,
                body: toolArgs.body,
                cc: ccList,
                isHtml: toolArgs.is_html || false,
                attachmentPaths: toolArgs.attachment_paths || undefined,
              });
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_get_messages') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.getMessages({
                maxResults: toolArgs.max_results || 10,
                query: toolArgs.query,
              });
              if (result.success && result.messages) {
                const formatted = result.messages.map(m => ({
                  id: m.id,
                  from: m.from,
                  subject: m.subject,
                  snippet: m.snippet,
                  date: m.date,
                  isUnread: m.isUnread,
                }));
                functionResponses.push({ functionResponse: { name: toolName, response: { success: true, messages: formatted, count: formatted.length } } });
              } else {
                functionResponses.push({ functionResponse: { name: toolName, response: result } });
              }
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_read_message') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.getMessage(toolArgs.message_id);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_trash') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.trashMessage(toolArgs.message_id);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_get_labels') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.getLabels();
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_create_label') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.createLabel(toolArgs.name);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gmail_modify_labels') {
          try {
            if (!this.gmailService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Gmail no conectado.' } } });
            } else {
              const result = await this.gmailService.modifyLabels(
                toolArgs.message_id,
                toolArgs.add_labels,
                toolArgs.remove_labels,
              );
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        // ─── Google Drive API Handlers ───────────────────────────────
        if (toolName === 'drive_list_files') {
          try {
            if (!this.driveService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Drive no conectado.' } } });
            } else {
              const result = await this.driveService.listFiles({
                folderId: toolArgs.folder_id,
                maxResults: toolArgs.max_results || 20,
              });
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'drive_search') {
          try {
            if (!this.driveService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Drive no conectado.' } } });
            } else {
              const result = await this.driveService.searchFiles(toolArgs.query);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'drive_download') {
          try {
            if (!this.driveService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Drive no conectado.' } } });
            } else {
              const tmpDir = app.getPath('temp');
              const destPath = path.join(tmpDir, toolArgs.file_name);
              const result = await this.driveService.downloadFile(toolArgs.file_id, destPath);
              functionResponses.push({ functionResponse: { name: toolName, response: { ...result, localPath: destPath } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'drive_upload') {
          try {
            if (!this.driveService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Drive no conectado.' } } });
            } else {
              const result = await this.driveService.uploadFile(toolArgs.file_path, {
                name: toolArgs.name,
                folderId: toolArgs.folder_id,
              });
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'drive_create_folder') {
          try {
            if (!this.driveService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Drive no conectado.' } } });
            } else {
              const result = await this.driveService.createFolder(toolArgs.name, toolArgs.parent_id);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        // ─── Google Chat API Handlers ─────────────────────────────────
        if (toolName === 'gchat_list_spaces') {
          try {
            if (!this.gchatService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Chat no conectado. El usuario debe conectar Google en SofLIA Hub.' } } });
            } else {
              const result = await this.gchatService.listSpaces();
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gchat_get_messages') {
          try {
            if (!this.gchatService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Chat no conectado.' } } });
            } else {
              const result = await this.gchatService.getMessages(toolArgs.space_name, toolArgs.max_results);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gchat_send_message') {
          try {
            if (!this.gchatService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Chat no conectado.' } } });
            } else {
              const result = await this.gchatService.sendMessage(toolArgs.space_name, toolArgs.text, toolArgs.thread_name);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gchat_add_reaction') {
          try {
            if (!this.gchatService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Chat no conectado.' } } });
            } else {
              const result = await this.gchatService.addReaction(toolArgs.message_name, toolArgs.emoji);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'gchat_get_members') {
          try {
            if (!this.gchatService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Google Chat no conectado.' } } });
            } else {
              const result = await this.gchatService.getMembers(toolArgs.space_name);
              functionResponses.push({ functionResponse: { name: toolName, response: result } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        // ─── AutoDev Tool Handlers ────────────────────────────────────
        if (toolName === 'autodev_get_status') {
          try {
            if (!this.autoDevService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
            } else {
              const status = this.autoDevService.getStatus();
              functionResponses.push({ functionResponse: { name: toolName, response: { success: true, ...status } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'autodev_run_now') {
          try {
            if (!this.autoDevService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
            } else {
              this.autoDevService.runNow().catch(err => {
                console.error('[WA AutoDev] Run error:', err.message);
              });
              functionResponses.push({ functionResponse: { name: toolName, response: { success: true, message: 'AutoDev run iniciado. Te notificaré cuando termine.' } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'autodev_get_history') {
          try {
            if (!this.autoDevService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
            } else {
              const history = this.autoDevService.getHistory().slice(-10); // Last 10 runs
              functionResponses.push({ functionResponse: { name: toolName, response: { success: true, runs: history } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        if (toolName === 'autodev_update_config') {
          try {
            if (!this.autoDevService) {
              functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
            } else {
              const updates: any = {};
              if (toolArgs.enabled !== undefined) updates.enabled = toolArgs.enabled;
              if (toolArgs.cron_schedule) updates.cronSchedule = toolArgs.cron_schedule;
              if (toolArgs.notify_phone) updates.notifyPhone = toolArgs.notify_phone;
              if (toolArgs.categories) {
                updates.categories = toolArgs.categories.split(',').map((c: string) => c.trim());
              }
              const config = this.autoDevService.updateConfig(updates);
              functionResponses.push({ functionResponse: { name: toolName, response: { success: true, config } } });
            }
          } catch (err: any) {
            functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
          }
          continue;
        }

        // ─── IRIS / Project Hub Tool Handlers ───────────────────────
        if (toolName === 'iris_login') {
          try {
            const result = await authenticateWhatsAppUser(senderNumber, toolArgs.email, toolArgs.password);
            functionResponses.push({
              functionResponse: { name: toolName, response: result },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_logout') {
          const success = logoutWhatsAppUser(senderNumber);
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: {
                success,
                message: success ? 'Sesión cerrada correctamente.' : 'No tenías sesión activa.',
              },
            },
          });
          continue;
        }

        if (toolName === 'iris_get_my_tasks') {
          const currentSession = getWhatsAppSession(senderNumber);
          if (!currentSession) {
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: false, message: 'No has iniciado sesión. Envía tu email y contraseña para autenticarte.' },
              },
            });
          } else {
            try {
              const issues = await irisGetIssues({
                assigneeId: currentSession.userId,
                projectId: toolArgs.project_id,
                limit: toolArgs.limit || 20,
              });
              const formatted = issues.map(i => ({
                number: i.issue_number,
                title: i.title,
                status: i.status?.name || 'Sin estado',
                priority: i.priority?.name || 'Sin prioridad',
                due_date: i.due_date || null,
                project_id: i.project_id || null,
              }));
              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { success: true, tasks: formatted, count: formatted.length, user: currentSession.fullName },
                },
              });
            } catch (err: any) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, message: err.message } },
              });
            }
          }
          continue;
        }

        if (toolName === 'iris_get_projects') {
          try {
            const projects = await irisGetProjects(toolArgs.team_id);
            const formatted = projects.map(p => ({
              name: p.project_name,
              key: p.project_key,
              status: p.project_status,
              progress: p.completion_percentage,
              priority: p.priority_level,
              id: p.project_id,
            }));
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, projects: formatted, count: formatted.length },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_get_teams') {
          try {
            const teams = await irisGetTeams();
            const formatted = teams.map(t => ({
              name: t.name,
              slug: t.slug,
              status: t.status,
              id: t.team_id,
            }));
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, teams: formatted, count: formatted.length },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_get_issues') {
          try {
            const issues = await irisGetIssues({
              teamId: toolArgs.team_id,
              projectId: toolArgs.project_id,
              assigneeId: toolArgs.assignee_id,
              limit: toolArgs.limit || 20,
            });
            const formatted = issues.map(i => ({
              number: i.issue_number,
              title: i.title,
              status: i.status?.name || 'Sin estado',
              priority: i.priority?.name || 'Sin prioridad',
              assignee_id: i.assignee_id || 'Sin asignar',
              due_date: i.due_date || null,
              project_id: i.project_id || null,
            }));
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, issues: formatted, count: formatted.length },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_get_statuses') {
          try {
            const statuses = await irisGetStatuses(toolArgs.team_id);
            const priorities = await irisGetPriorities();
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { success: true, statuses, priorities },
              },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_create_task') {
          const currentSession = getWhatsAppSession(senderNumber);
          if (!currentSession) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: 'No has iniciado sesión.' } },
            });
          } else {
            try {
              const result = await irisCreateIssue({
                teamId: toolArgs.team_id,
                title: toolArgs.title,
                creatorId: currentSession.userId,
                description: toolArgs.description,
                projectId: toolArgs.project_id,
                priorityId: toolArgs.priority_id,
                assigneeId: toolArgs.assignee_id,
                dueDate: toolArgs.due_date,
              });
              functionResponses.push({
                functionResponse: { name: toolName, response: result },
              });
            } catch (err: any) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, message: err.message } },
              });
            }
          }
          continue;
        }

        if (toolName === 'iris_update_task_status') {
          try {
            const result = await irisUpdateIssueStatus({
              issueId: toolArgs.issue_id,
              issueNumber: toolArgs.issue_number,
              teamId: toolArgs.team_id,
              newStatusName: toolArgs.new_status_name,
              newStatusId: toolArgs.new_status_id,
            });
            functionResponses.push({
              functionResponse: { name: toolName, response: result },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        if (toolName === 'iris_create_project') {
          const currentSession = getWhatsAppSession(senderNumber);
          if (!currentSession) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: 'No has iniciado sesión.' } },
            });
          } else {
            try {
              const result = await irisCreateProject({
                projectName: toolArgs.project_name,
                projectKey: toolArgs.project_key || '',
                createdByUserId: currentSession.userId,
                teamId: toolArgs.team_id,
                description: toolArgs.description,
                priorityLevel: toolArgs.priority_level,
                startDate: toolArgs.start_date,
                targetDate: toolArgs.target_date,
              });
              functionResponses.push({
                functionResponse: { name: toolName, response: result },
              });
            } catch (err: any) {
              functionResponses.push({
                functionResponse: { name: toolName, response: { success: false, message: err.message } },
              });
            }
          }
          continue;
        }

        if (toolName === 'iris_update_project_status') {
          try {
            const result = await irisUpdateProjectStatus({
              projectId: toolArgs.project_id,
              newStatus: toolArgs.new_status,
            });
            functionResponses.push({
              functionResponse: { name: toolName, response: result },
            });
          } catch (err: any) {
            functionResponses.push({
              functionResponse: { name: toolName, response: { success: false, message: err.message } },
            });
          }
          continue;
        }

        // Execute the tool via computer-use-handlers (fallback for all other tools)
        try {
          const result = await executeToolDirect(toolName, toolArgs);
          functionResponses.push({
            functionResponse: { name: toolName, response: result },
          });
        } catch (err: any) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { success: false, error: err.message },
            },
          });
        }
      }

      // Send function responses back to model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    return 'He completado las acciones solicitadas.';
  }

  private async requestConfirmation(
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, any>
  ): Promise<boolean> {
    const emoji = toolName === 'delete_item' ? '🗑️' : '📧';
    await this.waService.sendText(
      jid,
      `${emoji} *Confirmación requerida*\n\n${description}\n\n¿Confirmas? Responde *SI* para proceder o cualquier otra cosa para cancelar.`
    );

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pendingConfirmations.delete(senderNumber);
        resolve(false);
        this.waService.sendText(jid, 'Tiempo de confirmación agotado. Acción cancelada.');
      }, 60000); // 1 minute timeout

      pendingConfirmations.set(senderNumber, { toolName, args, resolve, timeout });
    });
  }
}
