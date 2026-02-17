/**
 * Computer Use IPC Handlers — Main Process
 * Provides real filesystem, shell, and system operations for SofLIA.
 */
import { ipcMain, shell, clipboard, desktopCapturer, dialog, BrowserWindow, app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import nodemailer from 'nodemailer';

// ─── Security ────────────────────────────────────────────────────────
const MAX_FILE_READ_SIZE = 1 * 1024 * 1024; // 1 MB
const COMMAND_TIMEOUT = 30_000; // 30 seconds
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_DEPTH = 5;

const BLOCKED_COMMANDS = [
  'format', 'diskpart', 'cipher /w', 'sfc', 'bcdedit',
  'reg delete', 'reg add', 'shutdown', 'taskkill /f /im explorer',
  'rd /s /q c:\\', 'del /f /s /q c:\\', 'rm -rf /',
  'mkfs', 'dd if=', ':(){:|:&};:',
  'net user', 'net localgroup administrators',
];

function isCommandBlocked(cmd: string): boolean {
  const lower = cmd.toLowerCase().trim();
  return BLOCKED_COMMANDS.some(b => lower.includes(b));
}

function normalizePath(p: string): string {
  return path.resolve(p.replace(/\//g, path.sep));
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext ? ext.slice(1) : '';
}

// ─── Email Config ─────────────────────────────────────────────────────
const EMAIL_CONFIG_PATH = path.join(app.getPath('userData'), 'email-config.json');

const SMTP_PROVIDERS: Record<string, { host: string; port: number }> = {
  'gmail.com':       { host: 'smtp.gmail.com',       port: 587 },
  'googlemail.com':  { host: 'smtp.gmail.com',       port: 587 },
  'outlook.com':     { host: 'smtp.office365.com',   port: 587 },
  'hotmail.com':     { host: 'smtp.office365.com',   port: 587 },
  'live.com':        { host: 'smtp.office365.com',   port: 587 },
  'yahoo.com':       { host: 'smtp.mail.yahoo.com',  port: 587 },
  'yahoo.com.mx':    { host: 'smtp.mail.yahoo.com',  port: 587 },
  'icloud.com':      { host: 'smtp.mail.me.com',     port: 587 },
  'me.com':          { host: 'smtp.mail.me.com',     port: 587 },
  'protonmail.com':  { host: 'smtp.protonmail.ch',   port: 587 },
  'zoho.com':        { host: 'smtp.zoho.com',        port: 587 },
};

function detectSmtp(email: string): { host: string; port: number } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return SMTP_PROVIDERS[domain] || null;
}

// ─── Tool Implementation (callable directly from main process) ──────
export async function executeToolDirect(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    case 'list_directory': {
      try {
        const resolved = normalizePath(args.path || os.homedir());
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const showHidden = args.show_hidden || false;

        const items = await Promise.all(
          entries
            .filter(e => showHidden || !e.name.startsWith('.'))
            .map(async (entry) => {
              const fullPath = path.join(resolved, entry.name);
              try {
                const stat = await fs.stat(fullPath);
                return {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: entry.isDirectory(),
                  size: entry.isDirectory() ? null : formatBytes(stat.size),
                  sizeBytes: stat.size,
                  extension: entry.isDirectory() ? null : getFileExtension(entry.name),
                  modified: stat.mtime.toISOString(),
                  created: stat.birthtime.toISOString(),
                };
              } catch {
                return {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: entry.isDirectory(),
                  size: null,
                  sizeBytes: 0,
                  extension: entry.isDirectory() ? null : getFileExtension(entry.name),
                  modified: null,
                  created: null,
                };
              }
            })
        );

        items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        return { success: true, path: resolved, items, count: items.length };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'read_file': {
      try {
        const resolved = normalizePath(args.path);
        const stat = await fs.stat(resolved);
        if (stat.isDirectory()) return { success: false, error: 'La ruta es un directorio, no un archivo.' };
        if (stat.size > MAX_FILE_READ_SIZE) return { success: false, error: `Archivo demasiado grande (${formatBytes(stat.size)}). Máximo: ${formatBytes(MAX_FILE_READ_SIZE)}.` };
        const content = await fs.readFile(resolved, 'utf-8');
        return { success: true, path: resolved, content, size: formatBytes(stat.size), extension: getFileExtension(resolved) };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'write_file': {
      try {
        const resolved = normalizePath(args.path);
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, args.content, 'utf-8');
        return { success: true, path: resolved, message: `Archivo creado/actualizado: ${path.basename(resolved)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'create_directory': {
      try {
        const resolved = normalizePath(args.path);
        await fs.mkdir(resolved, { recursive: true });
        return { success: true, path: resolved, message: `Carpeta creada: ${path.basename(resolved)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'move_item': {
      try {
        const src = normalizePath(args.source_path);
        const dst = normalizePath(args.destination_path);
        await fs.rename(src, dst);
        return { success: true, from: src, to: dst, message: `Movido: ${path.basename(src)} → ${path.basename(dst)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'copy_item': {
      try {
        const src = normalizePath(args.source_path);
        const dst = normalizePath(args.destination_path);
        const stat = await fs.stat(src);
        if (stat.isDirectory()) {
          await fs.cp(src, dst, { recursive: true });
        } else {
          await fs.mkdir(path.dirname(dst), { recursive: true });
          await fs.copyFile(src, dst);
        }
        return { success: true, from: src, to: dst, message: `Copiado: ${path.basename(src)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'delete_item': {
      try {
        const resolved = normalizePath(args.path);
        await shell.trashItem(resolved);
        return { success: true, path: resolved, message: `Enviado a papelera: ${path.basename(resolved)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'get_file_info': {
      try {
        const resolved = normalizePath(args.path);
        const stat = await fs.stat(resolved);
        return {
          success: true, path: resolved, name: path.basename(resolved),
          isDirectory: stat.isDirectory(), size: formatBytes(stat.size), sizeBytes: stat.size,
          extension: stat.isDirectory() ? null : getFileExtension(resolved),
          created: stat.birthtime.toISOString(), modified: stat.mtime.toISOString(), accessed: stat.atime.toISOString(),
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'search_files': {
      try {
        const resolved = normalizePath(args.directory || os.homedir());
        const results: Array<{ name: string; path: string; isDirectory: boolean }> = [];
        const lowerPattern = (args.pattern as string).toLowerCase();

        async function walk(dir: string, depth: number) {
          if (depth > MAX_SEARCH_DEPTH || results.length >= MAX_SEARCH_RESULTS) return;
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= MAX_SEARCH_RESULTS) break;
              if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.name.toLowerCase().includes(lowerPattern)) {
                results.push({ name: entry.name, path: fullPath, isDirectory: entry.isDirectory() });
              }
              if (entry.isDirectory()) await walk(fullPath, depth + 1);
            }
          } catch { /* skip */ }
        }

        await walk(resolved, 0);
        return { success: true, pattern: args.pattern, searchPath: resolved, results, count: results.length };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'execute_command': {
      if (isCommandBlocked(args.command)) {
        return { success: false, error: `Comando bloqueado por seguridad: "${args.command}"` };
      }
      return new Promise((resolve) => {
        exec(args.command, {
          timeout: COMMAND_TIMEOUT, maxBuffer: 1024 * 512, windowsHide: true,
          shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
        }, (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: error.message, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', exitCode: error.code });
          } else {
            resolve({ success: true, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '', exitCode: 0 });
          }
        });
      });
    }

    case 'open_application': {
      try {
        const result = await shell.openPath(normalizePath(args.path));
        if (result) return { success: false, error: result };
        return { success: true, message: `Abierto: ${args.path}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'open_url': {
      try {
        await shell.openExternal(args.url);
        return { success: true, message: `URL abierta: ${args.url}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'get_system_info': {
      try {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        return {
          success: true, platform: os.platform(), release: os.release(), arch: os.arch(),
          hostname: os.hostname(), username: os.userInfo().username, homeDir: os.homedir(), tempDir: os.tmpdir(),
          cpu: { model: cpus[0]?.model || 'Unknown', cores: cpus.length },
          memory: { total: formatBytes(totalMem), free: formatBytes(freeMem), used: formatBytes(totalMem - freeMem), usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
          uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'clipboard_read': {
      try {
        return { success: true, content: clipboard.readText() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'clipboard_write': {
      try {
        clipboard.writeText(args.text);
        return { success: true, message: 'Texto copiado al portapapeles.' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'take_screenshot': {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
        if (sources.length === 0) return { success: false, error: 'No se encontraron pantallas.' };
        return { success: true, image: sources[0].thumbnail.toDataURL() };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'get_email_config': {
      try {
        const data = await fs.readFile(EMAIL_CONFIG_PATH, 'utf-8');
        const config = JSON.parse(data);
        return { success: true, configured: true, email: config.user };
      } catch {
        return { success: true, configured: false };
      }
    }

    case 'configure_email': {
      try {
        const smtp = detectSmtp(args.email);
        if (!smtp) {
          const domain = args.email.split('@')[1] || 'desconocido';
          return { success: false, error: `No se pudo detectar la configuración SMTP para "${domain}". Proveedores soportados: Gmail, Outlook, Hotmail, Yahoo, iCloud, ProtonMail, Zoho.` };
        }
        const config = { host: smtp.host, port: smtp.port, user: args.email, password: args.password, defaultFrom: args.email };
        const transporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: { user: args.email, pass: args.password } });
        await transporter.verify();
        await fs.writeFile(EMAIL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return { success: true, message: `Email configurado correctamente con ${args.email}.` };
      } catch (err: any) {
        return { success: false, error: `Error al verificar credenciales: ${err.message}. Para Gmail necesitas una "contraseña de aplicación" (no tu contraseña normal). Ve a myaccount.google.com > Seguridad > Contraseñas de aplicaciones.` };
      }
    }

    case 'send_email': {
      try {
        let config: any;
        try {
          const data = await fs.readFile(EMAIL_CONFIG_PATH, 'utf-8');
          config = JSON.parse(data);
        } catch {
          return { success: false, error: 'Email no configurado. Pide al usuario su email y contraseña de aplicación, luego usa configure_email.' };
        }
        const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.password } });
        const attachments = args.attachment_paths
          ? await Promise.all(args.attachment_paths.map(async (filePath: string) => { const resolved = normalizePath(filePath); await fs.stat(resolved); return { filename: path.basename(resolved), path: resolved }; }))
          : [];
        const mailOptions: any = { from: config.defaultFrom || config.user, to: args.to, subject: args.subject, attachments };
        if (args.is_html) { mailOptions.html = args.body; } else { mailOptions.text = args.body; }
        const info = await transporter.sendMail(mailOptions);
        return { success: true, message: `Email enviado exitosamente a ${args.to}`, messageId: info.messageId, to: args.to, subject: args.subject, attachmentsCount: attachments.length };
      } catch (err: any) {
        return { success: false, error: `Error al enviar email: ${err.message}` };
      }
    }

    default:
      return { success: false, error: `Herramienta desconocida: ${toolName}` };
  }
}

// ─── Register IPC handlers (bridge to renderer) ─────────────────────
export function registerComputerUseHandlers() {
  ipcMain.handle('computer:list-directory', async (_, dirPath: string, showHidden = false) =>
    executeToolDirect('list_directory', { path: dirPath, show_hidden: showHidden }));

  ipcMain.handle('computer:read-file', async (_, filePath: string) =>
    executeToolDirect('read_file', { path: filePath }));

  ipcMain.handle('computer:write-file', async (_, filePath: string, content: string) =>
    executeToolDirect('write_file', { path: filePath, content }));

  ipcMain.handle('computer:create-directory', async (_, dirPath: string) =>
    executeToolDirect('create_directory', { path: dirPath }));

  ipcMain.handle('computer:move-item', async (_, sourcePath: string, destPath: string) =>
    executeToolDirect('move_item', { source_path: sourcePath, destination_path: destPath }));

  ipcMain.handle('computer:copy-item', async (_, sourcePath: string, destPath: string) =>
    executeToolDirect('copy_item', { source_path: sourcePath, destination_path: destPath }));

  ipcMain.handle('computer:delete-item', async (_, itemPath: string) =>
    executeToolDirect('delete_item', { path: itemPath }));

  ipcMain.handle('computer:get-file-info', async (_, filePath: string) =>
    executeToolDirect('get_file_info', { path: filePath }));

  ipcMain.handle('computer:search-files', async (_, dirPath: string, pattern: string) =>
    executeToolDirect('search_files', { directory: dirPath, pattern }));

  ipcMain.handle('computer:execute-command', async (_, command: string) =>
    executeToolDirect('execute_command', { command }));

  ipcMain.handle('computer:open-application', async (_, target: string) =>
    executeToolDirect('open_application', { path: target }));

  ipcMain.handle('computer:open-url', async (_, url: string) =>
    executeToolDirect('open_url', { url }));

  ipcMain.handle('computer:get-system-info', async () =>
    executeToolDirect('get_system_info', {}));

  ipcMain.handle('computer:clipboard-read', async () =>
    executeToolDirect('clipboard_read', {}));

  ipcMain.handle('computer:clipboard-write', async (_, text: string) =>
    executeToolDirect('clipboard_write', { text }));

  ipcMain.handle('computer:take-screenshot', async () =>
    executeToolDirect('take_screenshot', {}));

  // ── confirm_action (shows native dialog) ───────────────────────
  ipcMain.handle('computer:confirm-action', async (_event, message: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { confirmed: true };
    const result = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Cancelar', 'Confirmar'], defaultId: 0, cancelId: 0,
      title: 'SofLIA — Confirmar acción', message: 'SofLIA quiere realizar una acción', detail: message,
    });
    return { confirmed: result.response === 1 };
  });

  // ── Email IPC handlers ─────────────────────────────────────────
  ipcMain.handle('computer:get-email-config', async () =>
    executeToolDirect('get_email_config', {}));

  ipcMain.handle('computer:configure-email', async (_, email: string, password: string) =>
    executeToolDirect('configure_email', { email, password }));

  ipcMain.handle('computer:send-email', async (_, to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) =>
    executeToolDirect('send_email', { to, subject, body, attachment_paths: attachmentPaths, is_html: isHtml }));
}
