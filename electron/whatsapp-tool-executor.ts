/**
 * WhatsApp Tool Executor — extraído de whatsapp-agent.ts
 * Contiene la lógica de despacho para ~60 tools del agente WhatsApp.
 */
import { shell, desktopCapturer, app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executeToolDirect } from './computer-use-handlers';
import { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from './whatsapp-tools';
import { smartFindFile, webSearch, readWebpage } from './whatsapp-prompts';
import { handleTaskQueueTool } from './agent-task-queue';
import { handleTaskSchedulerTool } from './task-scheduler';
import { isGoogleTool, executeGoogleTool } from './whatsapp-executors/google-executors';
import { isIrisTool, executeIrisTool } from './whatsapp-executors/iris-executors';
import { isSystemTool, executeSystemTool } from './whatsapp-executors/system-executors';
import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { WhatsAppService } from './whatsapp-service';
import type { CalendarService } from './calendar-service';
import type { GmailService } from './gmail-service';
import type { DriveService } from './drive-service';
import type { GChatService } from './gchat-service';
import type { MemoryService } from './memory-service';
import type { KnowledgeService } from './knowledge-service';
import type { AutoDevService } from './autodev-service';
import type { DesktopAgentService } from './desktop-agent-service';
import type { ClipboardAIAssistant } from './clipboard-ai-assistant';
import type { TaskScheduler } from './task-scheduler';
import type { NeuralOrganizerService } from './neural-organizer';
import { SmartSearchTool } from './smart-search-tool';

export interface ToolExecutorContext {
  waService: WhatsAppService;
  calendarService: CalendarService | null;
  gmailService: GmailService | null;
  driveService: DriveService | null;
  gchatService: GChatService | null;
  autoDevService: AutoDevService | null;
  desktopAgent: DesktopAgentService | null;
  clipboardAssistant: ClipboardAIAssistant | null;
  taskScheduler: TaskScheduler | null;
  neuralOrganizer: NeuralOrganizerService | null;
  smartSearch: SmartSearchTool | null;
  memory: MemoryService;
  knowledge: KnowledgeService;
  getGenAI: () => GoogleGenerativeAI;
  requestConfirmation: (jid: string, senderNumber: string, toolName: string, description: string, args: Record<string, any>) => Promise<boolean>;
}

export type FunctionResponse = { functionResponse: { name: string; response: any } };

/**
 * Ejecuta todos los function calls de una iteración del agent loop.
 * Retorna las respuestas y un set de labels para verificación bulk.
 */
export async function executeWhatsAppTools(
  functionCalls: any[],
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<{ responses: FunctionResponse[]; bulkLabelsToVerify: Set<string> | null }> {
  const functionResponses: FunctionResponse[] = [];
  let bulkLabelsToVerify: Set<string> | null = null;

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

  // ─── SECURITY: Block access to SofLIA's own code/config ─────────
  // Prevents the attack where the AI uses execute_command, read_file, etc.
  // to read its own source code, API keys, or system prompt.
  const SOFLIA_BLOCKED_PATHS = [
    /soflia[\s_-]*hub/i,
    /dist[\\/\-]electron/i,
    /app\.asar/i,
    /SOFLIA[\s_]*Source/i,
    /whatsapp[\s_-]*agent/i,
    /desktop[\s_-]*agent/i,
    /main[\s_-]*.*\.js/i,
    /electron[\\/].*\.(ts|js)/i,
    /src[\\/].*\.(tsx?|jsx?)/i,
    /\.env\b/i,
    /supabase/i,
    /api[\s_-]*key/i,
  ];

  // Collect all string values from tool arguments for inspection
  const allArgValues = Object.values(toolArgs)
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  const isBlockedPath = SOFLIA_BLOCKED_PATHS.some(p => p.test(allArgValues));
  if (isBlockedPath) {
    console.warn(`[WhatsApp Agent] ⛔ SECURITY: Blocked tool "${toolName}" targeting SofLIA code: "${allArgValues.slice(0, 150)}"`);
    functionResponses.push({
      functionResponse: {
        name: toolName,
        response: { success: false, error: 'Acceso denegado: no puedo acceder a archivos del sistema de SofLIA por seguridad.' },
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
      case 'organize_files': desc = `📂 Organizar archivos en: ${toolArgs.path || 'directorio del usuario'}\nModo: ${toolArgs.mode || 'extension'}${toolArgs.dry_run ? ' (simulación)' : ''}`; break;
      case 'batch_move_files': desc = `📦 Mover archivos de: ${toolArgs.source_directory}\nA: ${toolArgs.destination_directory}${toolArgs.extensions ? `\nExtensiones: ${toolArgs.extensions.join(', ')}` : ''}`; break;
      default: desc = `${toolName}: ${JSON.stringify(toolArgs)}`;
    }

    const confirmed = await ctx.requestConfirmation(jid, senderNumber, toolName, desc, toolArgs);

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

  // ─── Delegated executors (domain-specific modules) ────────────
  if (isGoogleTool(toolName)) {
    const result = await executeGoogleTool(toolName, toolArgs, ctx, bulkLabelsToVerify);
    if (result) {
      functionResponses.push(result.response);
      bulkLabelsToVerify = result.bulkLabelsToVerify;
      continue;
    }
  }

  if (isIrisTool(toolName)) {
    const result = await executeIrisTool(toolName, toolArgs, senderNumber);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  if (isSystemTool(toolName)) {
    const result = await executeSystemTool(toolName, toolArgs);
    if (result) {
      functionResponses.push(result);
      continue;
    }
  }

  // Handle whatsapp_send_file specially
  if (toolName === 'whatsapp_send_file') {
    try {
      await ctx.waService.sendFile(jid, toolArgs.file_path, toolArgs.caption);
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

  // Handle save_whatsapp_file — copy received file to user-chosen location
  if (toolName === 'save_whatsapp_file') {
    try {
      const src = toolArgs.source_path;
      const dest = toolArgs.destination_path;
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: { success: true, message: `Archivo guardado en: ${dest}` },
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

  // Handle take_screenshot_and_send — capture ALL screens and send via WhatsApp
  if (toolName === 'take_screenshot_and_send') {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
      if (sources.length === 0) throw new Error('No se encontraron monitores');

      const monitorIndex = toolArgs.monitor_index;
      const screensToCapture = (monitorIndex !== undefined && monitorIndex !== null)
        ? [sources[monitorIndex] || sources[0]]
        : sources;

      const sentCount = screensToCapture.length;
      for (let i = 0; i < screensToCapture.length; i++) {
        const source = screensToCapture[i];
        const screenshotBase64 = source.thumbnail.toDataURL().replace(/^data:image\/png;base64,/, '');
        const tmpPath = path.join(app.getPath('temp'), `soflia_screenshot_${Date.now()}_monitor${i}.png`);
        await fs.writeFile(tmpPath, Buffer.from(screenshotBase64, 'base64'));
        const label = sources.length > 1 ? `Monitor ${i + 1} de ${sources.length}: ${source.name}` : 'Captura de pantalla';
        await ctx.waService.sendFile(jid, tmpPath, label);
        setTimeout(() => fs.unlink(tmpPath).catch(() => {}), 5000);
      }

      functionResponses.push({
        functionResponse: { name: toolName, response: { success: true, message: `${sentCount} captura(s) de pantalla enviada(s) por WhatsApp.`, monitors_total: sources.length, sent: sentCount } },
      });
    } catch (err: any) {
      functionResponses.push({
        functionResponse: { name: toolName, response: { success: false, error: err.message } },
      });
    }
    continue;
  }

  // Handle use_computer — autonomous desktop agent with proactive recovery + V2 progress reporting
  if (toolName === 'use_computer') {
    try {
      if (!ctx.desktopAgent) throw new Error('Desktop Agent no inicializado.');

      // V2: Set up progress reporting for long tasks
      const progressInterval = ctx.desktopAgent.getConfig().progressReportEveryNSteps || 25;
      const onStep = async (data: any) => {
        if (data.step % progressInterval === 0 && data.step > 0) {
          try {
            const progressMsg = `🖥️ Progreso: paso ${data.step}/${data.maxSteps}\n${data.action?.message || ''}`;
            await ctx.waService.sendText(jid, progressMsg);
          } catch { /* progress report is best-effort */ }
        }
      };
      const onPhase = async (data: any) => {
        try {
          const phaseMsg = `✅ Fase completada: ${data.phase?.name || 'Fase'}\nProgreso: ${data.phaseIndex + 1}/${data.totalPhases}${data.nextPhase ? `\nSiguiente: ${data.nextPhase.name}` : '\n🏁 Última fase completada'}`;
          await ctx.waService.sendText(jid, phaseMsg);
        } catch { /* phase report is best-effort */ }
      };
      ctx.desktopAgent.on('step', onStep);
      ctx.desktopAgent.on('phase-completed', onPhase);

      const result = await ctx.desktopAgent.executeTask(
        toolArgs.task,
        { maxSteps: toolArgs.max_steps },
      );

      ctx.desktopAgent.removeListener('step', onStep);
      ctx.desktopAgent.removeListener('phase-completed', onPhase);

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
      const result = ctx.memory.saveFact({
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
      const facts = ctx.memory.getFacts(senderNumber);
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
    const result = ctx.knowledge.saveToMemory(toolArgs.content, toolArgs.section);
    functionResponses.push({
      functionResponse: { name: toolName, response: result },
    });
    continue;
  }

  if (toolName === 'knowledge_update_user') {
    const result = ctx.knowledge.updateUserProfile(senderNumber, toolArgs.section, toolArgs.content);
    functionResponses.push({
      functionResponse: { name: toolName, response: result },
    });
    continue;
  }

  if (toolName === 'knowledge_search') {
    const results = ctx.knowledge.searchKnowledge(toolArgs.query, 8);
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
    const result = ctx.knowledge.saveToDailyLog(toolArgs.content, senderNumber);
    functionResponses.push({
      functionResponse: { name: toolName, response: result },
    });
    continue;
  }

  if (toolName === 'knowledge_read') {
    const result = ctx.knowledge.readKnowledgeFile(toolArgs.file);
    functionResponses.push({
      functionResponse: { name: toolName, response: result },
    });
    continue;
  }

  // ─── whatsapp_send_to_contact — Send to another number ──────
  if (toolName === 'whatsapp_send_to_contact') {
    try {
      // Normalize phone number: remove spaces, dashes, +, parentheses
      const cleanNumber = toolArgs.phone_number.replace(/[\s\-\+\(\)]/g, '');
      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      if (toolArgs.file_path) {
        await ctx.waService.sendFile(targetJid, toolArgs.file_path, toolArgs.caption || toolArgs.message);
      }
      if (toolArgs.message && !toolArgs.file_path) {
        await ctx.waService.sendText(targetJid, toolArgs.message);
      }
      // If both file and message, send message separately after file
      if (toolArgs.message && toolArgs.file_path) {
        await ctx.waService.sendText(targetJid, toolArgs.message);
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
        // ─── Create Word document using document-designer ─────────
        const { createProfessionalDocument } = await import('./document-designer');
        const filePath = path.join(saveDir, `${filename}.docx`);
        await createProfessionalDocument({
          content: toolArgs.content,
          title,
          author: 'SofLIA',
          outputPath: filePath,
          type: 'word',
          includeCover: true,
        });

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { success: true, file_path: filePath, message: `Documento Word profesional creado: ${filePath}` },
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
      } else if (docType === 'pptx' || docType === 'powerpoint' || docType === 'presentacion') {
        // ─── Create Premium Presentation PDF (15 slide types) ─────
        let premiumModule: any;
        try {
          premiumModule = await import('./presentation-premium');
        } catch (importErr) {
          console.warn('[create_document] presentation-premium no disponible, usando fallback:', importErr);
          premiumModule = await import('./presentation-pdf');
        }
        const { createPresentationPDF, parseMarkdownToSlides } = premiumModule;

        let slides: any[];
        if (toolArgs.slides_json) {
          try {
            slides = JSON.parse(toolArgs.slides_json);
          } catch {
            slides = parseMarkdownToSlides(toolArgs.content || '', title);
          }
        } else {
          slides = parseMarkdownToSlides(toolArgs.content || '', title);
        }

        const genAI = ctx.getGenAI();
        const includeImages = toolArgs.include_images !== false;

        let customTheme: any = undefined;
        if (toolArgs.custom_theme) {
          try {
            customTheme = JSON.parse(toolArgs.custom_theme);
          } catch {
            console.warn('[create_document] Failed to parse custom_theme, using default');
          }
        }

        const filePath = path.join(saveDir, `${filename}.pdf`);
        await createPresentationPDF({
          slides,
          title,
          outputPath: filePath,
          customTheme,
          includeImages,
          genAI,
        });

        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { success: true, file_path: filePath, message: `Presentación PDF premium creada: ${filePath} (${slides.length} diapositivas con diseño profesional e imágenes AI)` },
          },
        });
      } else {
        functionResponses.push({
          functionResponse: { name: toolName, response: { success: false, error: 'Tipo no válido. Usa "word", "excel", "pdf", "pptx" o "md".' } },
        });
      }
    } catch (err: any) {
      functionResponses.push({
        functionResponse: { name: toolName, response: { success: false, error: err.message } },
      });
    }
    continue;
  }

  // ─── AutoDev Tool Handlers ────────────────────────────────────
  if (toolName === 'autodev_get_status') {
    try {
      if (!ctx.autoDevService) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
      } else {
        const status = ctx.autoDevService.getStatus();
        functionResponses.push({ functionResponse: { name: toolName, response: { success: true, ...status } } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  if (toolName === 'autodev_run_now') {
    try {
      if (!ctx.autoDevService) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
      } else {
        ctx.autoDevService.runNow().catch(err => {
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
      if (!ctx.autoDevService) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
      } else {
        const history = ctx.autoDevService.getHistory().slice(-10); // Last 10 runs
        functionResponses.push({ functionResponse: { name: toolName, response: { success: true, runs: history } } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  if (toolName === 'autodev_update_config') {
    try {
      if (!ctx.autoDevService) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'AutoDev no configurado.' } } });
      } else {
        const updates: any = {};
        if (toolArgs.enabled !== undefined) updates.enabled = toolArgs.enabled;
        if (toolArgs.cron_schedule) updates.cronSchedule = toolArgs.cron_schedule;
        if (toolArgs.notify_phone) updates.notifyPhone = toolArgs.notify_phone;
        if (toolArgs.categories) {
          updates.categories = toolArgs.categories.split(',').map((c: string) => c.trim());
        }
        const config = ctx.autoDevService.updateConfig(updates);
        functionResponses.push({ functionResponse: { name: toolName, response: { success: true, config } } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  // ─── Clipboard AI Assistant Handler ──────────────────────────────
  if (toolName === 'search_clipboard_history') {
    try {
      if (!ctx.clipboardAssistant) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Clipboard Assistant no inicializado.' } } });
      } else {
        const result = await ctx.clipboardAssistant.searchClipboardHistory(toolArgs.query);
        functionResponses.push({ functionResponse: { name: toolName, response: { success: true, data: result } } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  // ─── Task Scheduler Handlers ────────────────────────────────────
  if (toolName === 'task_scheduler' || toolName === 'list_scheduled_tasks' || toolName === 'delete_scheduled_task') {
    try {
      if (!ctx.taskScheduler) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Task Scheduler no inicializado.' } } });
      } else {
        const result = await handleTaskSchedulerTool(ctx.taskScheduler, toolName, toolArgs, senderNumber);
        functionResponses.push({ functionResponse: { name: toolName, response: result } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  // ─── Agent Task Queue Handlers ──────────────────────────────────
  if (toolName === 'list_active_tasks' || toolName === 'cancel_background_task') {
    try {
      const result = await handleTaskQueueTool(toolName, toolArgs);
      functionResponses.push({ functionResponse: { name: toolName, response: result } });
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  // ─── Smart Search Handler ───────────────────────────────────────
  if (toolName === 'semantic_file_search') {
    try {
      if (!ctx.smartSearch) {
        ctx.smartSearch = new SmartSearchTool();
      }
      const result = ctx.smartSearch.searchFiles(toolArgs.query, toolArgs.max_results || 3);
      functionResponses.push({ functionResponse: { name: toolName, response: result } });
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
    }
    continue;
  }

  // ─── Neural Organizer Handlers ──────────────────────────────────
  if (toolName === 'neural_organizer_status' || toolName === 'neural_organizer_toggle') {
    try {
      if (!ctx.neuralOrganizer) {
        functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: 'Neural Organizer no inicializado. Configura primero la API key.' } } });
      } else {
        const result = ctx.neuralOrganizer.handleToolCall(toolName, toolArgs);
        functionResponses.push({ functionResponse: { name: toolName, response: result } });
      }
    } catch (err: any) {
      functionResponses.push({ functionResponse: { name: toolName, response: { success: false, error: err.message } } });
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

  return { responses: functionResponses, bulkLabelsToVerify };
}
