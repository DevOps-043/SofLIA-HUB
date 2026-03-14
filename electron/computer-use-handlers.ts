/**
 * Computer Use IPC Handlers — Main Process
 * Provides real filesystem, shell, and system operations for SofLIA.
 */
import { ipcMain, shell, clipboard, dialog, BrowserWindow, app, IpcMainInvokeEvent, desktopCapturer, screen } from 'electron';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import util from 'node:util';
import { createRequire } from 'node:module';

// Native/CJS modules loaded via require() to avoid ESM↔CJS interop crash
const _require = createRequire(import.meta.url);
const nodemailer = _require('nodemailer');
const si = _require('systeminformation');
const { createWorker } = _require('tesseract.js');
import { VisualDebuggerService } from './visual-debugger-service';
import { normalizePath, formatBytes, getFileExtension } from './utils/file-utils';
import { organizeFiles, batchMoveFiles, listDirectorySummary } from './computer-use/batch-file-ops';

// ─── Security ────────────────────────────────────────────────────────
const MAX_FILE_READ_SIZE = 1 * 1024 * 1024; // 1 MB
const COMMAND_TIMEOUT = 30_000; // 30 seconds
const MAX_SEARCH_RESULTS = 200;
const MAX_SEARCH_DEPTH = 8;

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

// ─── Computer Use GUI Automation Helpers ─────────────────────────────
const execAsync = util.promisify(exec);

async function performGuiAction(action: string, coordinate?: number[], text?: string): Promise<void> {
  const platform = os.platform();
  const [x, y] = coordinate ? [Math.round(coordinate[0]), Math.round(coordinate[1])] : [0, 0];

  const moveMouseWin = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`;
  const clickMouseWin = `
$signature = @"
[DllImport("user32.dll",CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
"@
$mouse = Add-Type -memberDefinition $signature -name "Win32MouseEventNew" -namespace Win32Functions -passThru
$mouse::mouse_event(0x0002, 0, 0, 0, 0)
$mouse::mouse_event(0x0004, 0, 0, 0, 0)
`;
  const typeTextWin = text ? `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${text.replace(/'/g, "''")}')` : '';

  const macMouseScript = `
import Quartz
def mouseEvent(type, posx, posy):
    theEvent = Quartz.CGEventCreateMouseEvent(None, type, (posx,posy), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, theEvent)
mouseEvent(Quartz.kCGEventMouseMoved, ${x}, ${y})
`;
  const macClickScript = macMouseScript + `
mouseEvent(Quartz.kCGEventLeftMouseDown, ${x}, ${y})
import time
time.sleep(0.05)
mouseEvent(Quartz.kCGEventLeftMouseUp, ${x}, ${y})
`;

  switch (action) {
    case 'mouse_move':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macMouseScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y}`);
      break;

    case 'left_click':
    case 'left_click_drag':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}; ${clickMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macClickScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y} click 1`);
      break;

    case 'right_click':
      if (platform === 'win32') {
        const rightClickWin = clickMouseWin.replace('0x0002', '0x0008').replace('0x0004', '0x0010');
        await execAsync(`powershell -Command "${moveMouseWin}; ${rightClickWin}"`);
      } else if (platform === 'darwin') {
        const macRight = macClickScript.replace(/Left/g, 'Right');
        await execAsync(`python3 -c "${macRight}"`);
      } else {
        await execAsync(`xdotool mousemove ${x} ${y} click 3`);
      }
      break;

    case 'middle_click':
      if (platform === 'win32') {
        await execAsync(`powershell -Command "${moveMouseWin}"`);
      } else if (platform === 'darwin') {
        const macMiddle = macClickScript.replace(/Left/g, 'Center');
        await execAsync(`python3 -c "${macMiddle}"`);
      } else {
        await execAsync(`xdotool mousemove ${x} ${y} click 2`);
      }
      break;

    case 'double_click':
      if (platform === 'win32') await execAsync(`powershell -Command "${moveMouseWin}; ${clickMouseWin}; Start-Sleep -Milliseconds 50; ${clickMouseWin}"`);
      else if (platform === 'darwin') await execAsync(`python3 -c "${macClickScript}\ntime.sleep(0.05)\n${macClickScript}"`);
      else await execAsync(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
      break;

    case 'type':
      if (!text) throw new Error("Texto requerido para acción 'type'");
      if (platform === 'win32') await execAsync(`powershell -Command "${typeTextWin}"`);
      else if (platform === 'darwin') {
        const escapedText = text.replace(/"/g, '\\"');
        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${escapedText}"'`);
      }
      else await execAsync(`xdotool type "${text}"`);
      break;

    case 'key':
      if (!text) throw new Error("Tecla requerida para acción 'key'");
      if (platform === 'win32') await execAsync(`powershell -Command "${typeTextWin}"`);
      else if (platform === 'darwin') {
        const keyMap: Record<string, string> = { 'Return': 'return', 'Enter': 'return', 'Escape': 'escape', 'Tab': 'tab' };
        const macKey = keyMap[text] || text;
        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${macKey}"'`);
      }
      else await execAsync(`xdotool key "${text}"`);
      break;

    default:
      throw new Error(`Acción GUI no soportada: ${action}`);
  }
}

async function findTextCoordinates(textToFind: string, imageBuffer: Buffer): Promise<{x: number, y: number, confidence: number}> {
  let worker;
  try {
    worker = await createWorker('spa');
  } catch (e) {
    worker = await createWorker('eng');
  }
  
  const ret = await worker.recognize(imageBuffer);
  await worker.terminate();

  const lowerText = textToFind.toLowerCase();
  
  for (const word of ret.data.words) {
    if (word.text.toLowerCase().includes(lowerText) && word.confidence > 50) {
      return {
        x: Math.round(word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2),
        y: Math.round(word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2),
        confidence: word.confidence
      };
    }
  }

  for (const line of ret.data.lines) {
    if (line.text.toLowerCase().includes(lowerText) && line.confidence > 40) {
      return {
        x: Math.round(line.bbox.x0 + (line.bbox.x1 - line.bbox.x0) / 2),
        y: Math.round(line.bbox.y0 + (line.bbox.y1 - line.bbox.y0) / 2),
        confidence: line.confidence
      };
    }
  }

  throw new Error(`Elemento con texto "${textToFind}" no encontrado en pantalla (OCR no lo detectó).`);
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

// ─── Process & Screen Handlers ───────────────────────────────────────

async function handleListScreens(): Promise<{ success: boolean; screens?: Array<{ id: string; name: string; display_id: string }>; count?: number; error?: string }> {
  try {
    console.log('[ComputerUse] Fetching screen sources...');
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 } // Ahorro de memoria, no genera imágenes
    });
    const screens = sources.map((s: any) => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id
    }));
    console.log(`[ComputerUse] Found ${screens.length} screen(s).`);
    return { success: true, screens, count: screens.length };
  } catch (err: any) {
    console.error('[ComputerUse] Error listing screens:', err);
    return { success: false, error: err.message };
  }
}

async function handleListProcesses(): Promise<{ success: boolean; processes?: Array<{ pid: number; name: string; cpu: number; mem: number; command: string }>; count?: number; error?: string }> {
  try {
    console.log('[ComputerUse] Listing system processes...');
    const data = await si.processes();
    const list = data.list.sort((a, b) => b.cpu - a.cpu).slice(0, 20);
    const processes = list.map(p => ({
      pid: p.pid,
      name: p.name || 'Unknown',
      cpu: Number((p.cpu || 0).toFixed(2)),
      mem: Number((p.mem || 0).toFixed(2)),
      command: p.command || ''
    }));
    console.log(`[ComputerUse] Retrieved top ${processes.length} processes by CPU.`);
    return { success: true, processes, count: processes.length };
  } catch (err: any) {
    console.error('[ComputerUse] Error listing processes:', err);
    return { success: false, error: err.message };
  }
}

async function handleKillProcess(pid: number): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log(`[ComputerUse] Attempting to kill process PID: ${pid}`);
    if (isNaN(pid) || typeof pid !== 'number' || pid <= 0) {
      console.warn(`[ComputerUse] Invalid PID provided: ${pid}`);
      return { success: false, error: 'PID inválido o no proporcionado (debe ser un número positivo).' };
    }
    process.kill(pid, 'SIGKILL');
    console.log(`[ComputerUse] Successfully sent SIGKILL to PID: ${pid}`);
    return { success: true, message: `Proceso ${pid} terminado exitosamente` };
  } catch (err: any) {
    console.error(`[ComputerUse] Error killing process ${pid}:`, err);
    return { success: false, error: err.message };
  }
}

// ─── Tool Implementation (callable directly from main process) ──────
export async function executeToolDirect(
  toolName: string,
  args: Record<string, any>,
  onProgress?: (message: string) => void
): Promise<any> {
  switch (toolName) {
    case 'list_screens':
      return await handleListScreens();

    case 'list_processes':
      return await handleListProcesses();

    case 'kill_process':
      return await handleKillProcess(Number(args.pid));

    case 'list_directory': {
      try {
        const resolved = normalizePath(args.path || os.homedir());
        if (onProgress) onProgress(`Listando directorio: ${resolved}...`);
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const showHidden = args.show_hidden || false;

        if (entries.length > 100 && onProgress) {
          onProgress(`Analizando detalles de ${entries.length} elementos...`);
        }

        let processedCount = 0;
        const items = await Promise.all(
          entries
            .filter(e => showHidden || !e.name.startsWith('.'))
            .map(async (entry) => {
              processedCount++;
              if (processedCount % 100 === 0 && onProgress) {
                onProgress(`Leyendo detalles... ${processedCount} de ${entries.length} archivos procesados.`);
              }
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

        const ext = getFileExtension(resolved);

        // Handle .docx files — extract text using mammoth
        if (ext === 'docx') {
          try {
            const mammoth = await import('mammoth');
            const buffer = await fs.readFile(resolved);
            const result = await mammoth.extractRawText({ buffer });
            return { success: true, path: resolved, content: result.value, size: formatBytes(stat.size), extension: ext, format: 'docx (texto extraído)' };
          } catch (docxErr: any) {
            return { success: false, error: `Error al leer archivo .docx: ${docxErr.message}` };
          }
        }

        const content = await fs.readFile(resolved, 'utf-8');
        return { success: true, path: resolved, content, size: formatBytes(stat.size), extension: ext };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'write_file': {
      try {
        const resolved = normalizePath(args.path);
        if (onProgress) onProgress(`Escribiendo archivo: ${resolved}...`);
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
        try {
          await fs.mkdir(resolved, { recursive: true });
        } catch (err: any) {
          if (err.code === 'EEXIST') {
            return { success: true, path: resolved, message: `La carpeta ya existe: ${path.basename(resolved)}` };
          }
          throw err;
        }
        return { success: true, path: resolved, message: `Carpeta creada: ${path.basename(resolved)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'move_item': {
      try {
        const src = normalizePath(args.source_path);
        const dst = normalizePath(args.destination_path);
        if (onProgress) onProgress(`Moviendo ${src} a ${dst}...`);
        try {
          await fs.rename(src, dst);
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            await fs.mkdir(path.dirname(dst), { recursive: true });
            await fs.rename(src, dst);
          }
          else {
            throw err;
          }
        }
        return { success: true, from: src, to: dst, message: `Movido: ${path.basename(src)} → ${path.basename(dst)}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    case 'copy_item': {
      try {
        const src = normalizePath(args.source_path);
        const dst = normalizePath(args.destination_path);
        if (onProgress) onProgress(`Copiando de ${src} a ${dst}...`);
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
        if (onProgress) onProgress(`Enviando a la papelera: ${resolved}...`);
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
        if (onProgress) onProgress(`Iniciando búsqueda en ${resolved}...`);
        const results: Array<{ name: string; path: string; isDirectory: boolean }> = [];
        const lowerPattern = (args.pattern as string).toLowerCase();
        let scanned = 0;

        async function walk(dir: string, depth: number) {
          if (depth > MAX_SEARCH_DEPTH || results.length >= MAX_SEARCH_RESULTS) return;
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= MAX_SEARCH_RESULTS) break;
              scanned++;
              if (scanned % 500 === 0 && onProgress) {
                onProgress(`Buscando... Escaneados ${scanned} elementos, encontrados ${results.length}.`);
              }
              if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'AppData' || entry.name === '$Recycle.Bin' || entry.name === 'dist' || entry.name === 'dist-electron') continue;
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

    // ─── Batch File Operations (delegated to computer-use/batch-file-ops) ───

    case 'organize_files':
      return await organizeFiles(args, onProgress);

    case 'batch_move_files':
      return await batchMoveFiles(args, onProgress);

    case 'list_directory_summary':
      return await listDirectorySummary(args, onProgress);

    case 'execute_command': {
      if (isCommandBlocked(args.command)) {
        return { success: false, error: `Comando bloqueado por seguridad: "${args.command}"` };
      }
      if (onProgress) onProgress(`Ejecutando comando en segundo plano: ${args.command.substring(0, 50)}${args.command.length > 50 ? '...' : ''}`);
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

    case 'open_file_on_computer':
    case 'open_application': {
      try {
        if (!args.path) {
          return { success: false, error: 'Debe proporcionar la ruta del archivo o aplicación (path).' };
        }
        const resolvedPath = normalizePath(args.path);
        
        if (!fsSync.existsSync(resolvedPath)) {
          return { 
            success: false, 
            error: `El archivo no existe en la ruta proporcionada: ${resolvedPath}. Verifique la ruta con search_files o list_directory e intente nuevamente.` 
          };
        }
        
        // shell.openPath is the proper non-blocking native way in Electron
        const result = await shell.openPath(resolvedPath);
        if (result !== '') {
          return { 
            success: false, 
            error: `Error al abrir el archivo o aplicación: "${result}". Asegúrese de que la ruta sea correcta, que tenga permisos de lectura/ejecución y que el sistema operativo tenga un programa predeterminado para abrir este tipo de archivo.` 
          };
        }
        return { success: true, message: `Abierto exitosamente: ${resolvedPath}` };
      } catch (err: any) {
        return { success: false, error: `Excepción al abrir el archivo: ${err.message}` };
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
        const home = os.homedir();
        // Detect actual desktop path (OneDrive or standard)
        const possibleDesktops = [
          path.join(home, 'OneDrive', 'Escritorio'),
          path.join(home, 'OneDrive', 'Desktop'),
          path.join(home, 'Desktop'),
          path.join(home, 'Escritorio'),
        ];
        let desktopPath = path.join(home, 'Desktop');
        for (const dp of possibleDesktops) {
          try {
            fsSync.accessSync(dp);
            desktopPath = dp;
            break;
          } catch { /* try next */ }
        }
        return {
          success: true, platform: os.platform(), release: os.release(), arch: os.arch(),
          hostname: os.hostname(), username: os.userInfo().username, homeDir: home, tempDir: os.tmpdir(),
          desktopPath,
          documentsPath: path.join(home, 'Documents'),
          downloadsPath: path.join(home, 'Downloads'),
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

    case 'use_computer':
    case 'take_screenshot': {
      let lastKnownCoords = { x: 0, y: 0 };
      try {
        const action = args.action || 'screenshot';
        if (args.coordinate && Array.isArray(args.coordinate) && args.coordinate.length >= 2) {
          lastKnownCoords = { x: Math.round(args.coordinate[0]), y: Math.round(args.coordinate[1]) };
        }

        if (action === 'screenshot' || toolName === 'take_screenshot') {
          if (onProgress) onProgress('Iniciando captura de pantalla...');
          
          // Determine optimal screen dimensions for the screenshot to prevent undefined thumbnails
          let targetWidth = 1920;
          let targetHeight = 1080;
          try {
            const primaryDisplay = screen.getPrimaryDisplay();
            targetWidth = Math.floor(primaryDisplay.size.width * primaryDisplay.scaleFactor);
            targetHeight = Math.floor(primaryDisplay.size.height * primaryDisplay.scaleFactor);
          } catch { /* fallback */ }

          if (args.width) targetWidth = Number(args.width);
          if (args.height) targetHeight = Number(args.height);

          // desktopCapturer debe ejecutarse en el Main Process con dimensiones específicas
          let sources;
          try {
            sources = await desktopCapturer.getSources({ 
              types: ['screen'],
              thumbnailSize: { width: targetWidth, height: targetHeight }
            });
          } catch (dcErr: any) {
            return { success: false, error: `Error interno de desktopCapturer: ${dcErr.message}` };
          }
          
          if (!sources || sources.length === 0) return { success: false, error: 'No se encontraron pantallas.' };
          
          let targetSource = sources[0];
          if (args.display_id) {
            targetSource = sources.find((s: any) => s.display_id === args.display_id) || sources[0];
          }

          if (!targetSource || !targetSource.thumbnail) {
            return { success: false, error: 'No se pudo generar la captura de la pantalla (thumbnail indefinido). Asegure el uso de Electron Main Process.' };
          }

          let axTree = undefined;
          try {
            if (onProgress) onProgress('Iniciando OCR y extracción de árbol de accesibilidad visual...');
            if (typeof BrowserWindow !== 'undefined' && BrowserWindow.getAllWindows) {
              const windows = BrowserWindow.getAllWindows();
              if (windows.length > 0) {
                const focusedWindow = BrowserWindow.getFocusedWindow() || windows[0];
                const webContents = focusedWindow.webContents;
                if (webContents) {
                  if (!webContents.debugger.isAttached()) {
                    try { webContents.debugger.attach('1.3'); } catch (e) { /* might be attached already */ }
                  }
                  axTree = await webContents.debugger.sendCommand('Accessibility.getFullAXTree');
                }
              }
            }
          } catch (axErr: any) {
            console.error('Error fetching AXTree:', axErr);
          }

          const imageBase64 = targetSource.thumbnail.toDataURL();

          return { 
            success: true, 
            image: imageBase64,
            axTree
          };
        } else {
          // ================= GUI ACTIONS =================
          try {
            if (onProgress) onProgress(`Ejecutando acción GUI: ${action}...`);

            // Búsqueda de elementos mediante OCR por texto
            if (!args.coordinate && args.text && ['left_click', 'right_click', 'double_click', 'mouse_move', 'left_click_drag'].includes(action)) {
              if (onProgress) onProgress(`Buscando texto "${args.text}" en pantalla con OCR...`);
              
              const capture = await executeToolDirect('take_screenshot', { display_id: args.display_id });
              if (!capture.success) throw new Error(capture.error);
              
              const base64Data = capture.image.replace(/^data:image\/png;base64,/, "");
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              const coords = await findTextCoordinates(args.text, imageBuffer);
              lastKnownCoords = { x: coords.x, y: coords.y };
              args.coordinate = [coords.x, coords.y];
              
              if (onProgress) onProgress(`Texto encontrado en coordenadas: [${coords.x}, ${coords.y}] (Confianza: ${Math.round(coords.confidence)}%)`);
            }

            await performGuiAction(action, args.coordinate, args.text);

            // Retornamos captura actualizada después de la acción GUI
            return await executeToolDirect('take_screenshot', { display_id: args.display_id }, onProgress);

          } catch (err: any) {
            // Eliminamos la "caja negra" generando y lanzando un visual debugger error interactivo
            const { x, y } = lastKnownCoords;
            await VisualDebuggerService.handleVisualError(err.message, x, y);
            throw err; 
          }
        }
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
        if (onProgress) onProgress(`Preparando envío de email a ${args.to}...`);
        let config: any;
        try {
          const data = await fs.readFile(EMAIL_CONFIG_PATH, 'utf-8');
          config = JSON.parse(data);
        } catch {
          return { success: false, error: 'Email no configurado. Pide al usuario su email y contraseña de aplicación, luego usa configure_email.' };
        }
        const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.password } });
        if (onProgress && args.attachment_paths && args.attachment_paths.length > 0) {
          onProgress(`Cargando ${args.attachment_paths.length} archivos adjuntos...`);
        }
        const attachments = args.attachment_paths
          ? await Promise.all(args.attachment_paths.map(async (filePath: string) => { const resolved = normalizePath(filePath); await fs.stat(resolved); return { filename: path.basename(resolved), path: resolved }; }))
          : [];
        const mailOptions: any = { from: config.defaultFrom || config.user, to: args.to, subject: args.subject, attachments };
        if (args.is_html) { mailOptions.html = args.body; } else { mailOptions.text = args.body; }
        if (onProgress) onProgress('Enviando mensaje al servidor SMTP...');
        const info = await transporter.sendMail(mailOptions);
        if (onProgress) onProgress('Email enviado con éxito.');
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
  const makeProgress = (event: IpcMainInvokeEvent, toolName: string) => {
    return (message: string) => {
      try {
        if (!event.sender.isDestroyed()) {
          event.sender.send('computer:progress', { tool: toolName, message });
        }
      } catch { /* ignore */ }
    };
  };

  ipcMain.handle('computer:list-screens', async (event) =>
    executeToolDirect('list_screens', {}, makeProgress(event, 'list_screens')));

  ipcMain.handle('computer:list-processes', async (event) =>
    executeToolDirect('list_processes', {}, makeProgress(event, 'list_processes')));

  ipcMain.handle('computer:kill-process', async (event, pid: number) =>
    executeToolDirect('kill_process', { pid }, makeProgress(event, 'kill_process')));

  ipcMain.handle('computer:list-directory', async (event, dirPath: string, showHidden = false) =>
    executeToolDirect('list_directory', { path: dirPath, show_hidden: showHidden }, makeProgress(event, 'list_directory')));

  ipcMain.handle('computer:read-file', async (event, filePath: string) =>
    executeToolDirect('read_file', { path: filePath }, makeProgress(event, 'read_file')));

  ipcMain.handle('computer:write-file', async (event, filePath: string, content: string) =>
    executeToolDirect('write_file', { path: filePath, content }, makeProgress(event, 'write_file')));

  ipcMain.handle('computer:create-directory', async (event, dirPath: string) =>
    executeToolDirect('create_directory', { path: dirPath }, makeProgress(event, 'create_directory')));

  ipcMain.handle('computer:move-item', async (event, sourcePath: string, destPath: string) =>
    executeToolDirect('move_item', { source_path: sourcePath, destination_path: destPath }, makeProgress(event, 'move_item')));

  ipcMain.handle('computer:copy-item', async (event, sourcePath: string, destPath: string) =>
    executeToolDirect('copy_item', { source_path: sourcePath, destination_path: destPath }, makeProgress(event, 'copy_item')));

  ipcMain.handle('computer:delete-item', async (event, itemPath: string) =>
    executeToolDirect('delete_item', { path: itemPath }, makeProgress(event, 'delete_item')));

  ipcMain.handle('computer:get-file-info', async (event, filePath: string) =>
    executeToolDirect('get_file_info', { path: filePath }, makeProgress(event, 'get_file_info')));

  ipcMain.handle('computer:search-files', async (event, dirPath: string, pattern: string) =>
    executeToolDirect('search_files', { directory: dirPath, pattern }, makeProgress(event, 'search_files')));

  ipcMain.handle('computer:organize-files', async (event, dirPath: string, mode?: string, rules?: Record<string, string>, dryRun?: boolean) =>
    executeToolDirect('organize_files', { path: dirPath, mode, rules, dry_run: dryRun }, makeProgress(event, 'organize_files')));

  ipcMain.handle('computer:batch-move-files', async (event, sourceDir: string, destDir: string, extensions?: string[], pattern?: string) =>
    executeToolDirect('batch_move_files', { source_directory: sourceDir, destination_directory: destDir, extensions, pattern }, makeProgress(event, 'batch_move_files')));

  ipcMain.handle('computer:list-directory-summary', async (event, dirPath: string) =>
    executeToolDirect('list_directory_summary', { path: dirPath }, makeProgress(event, 'list_directory_summary')));

  ipcMain.handle('computer:execute-command', async (event, command: string) =>
    executeToolDirect('execute_command', { command }, makeProgress(event, 'execute_command')));

  ipcMain.handle('computer:open-application', async (event, target: string) =>
    executeToolDirect('open_application', { path: target }, makeProgress(event, 'open_application')));

  ipcMain.handle('computer:open-file-on-computer', async (event, target: string) =>
    executeToolDirect('open_file_on_computer', { path: target }, makeProgress(event, 'open_file_on_computer')));

  ipcMain.handle('computer:open-url', async (event, url: string) =>
    executeToolDirect('open_url', { url }, makeProgress(event, 'open_url')));

  ipcMain.handle('computer:get-system-info', async (event) =>
    executeToolDirect('get_system_info', {}, makeProgress(event, 'get_system_info')));

  ipcMain.handle('computer:clipboard-read', async (event) =>
    executeToolDirect('clipboard_read', {}, makeProgress(event, 'clipboard_read')));

  ipcMain.handle('computer:clipboard-write', async (event, text: string) =>
    executeToolDirect('clipboard_write', { text }, makeProgress(event, 'clipboard_write')));

  ipcMain.handle('computer:use-computer', async (event, args: any) =>
    executeToolDirect('use_computer', args, makeProgress(event, 'use_computer')));

  ipcMain.handle('computer:take-screenshot', async (event, displayId?: string) =>
    executeToolDirect('take_screenshot', { display_id: displayId }, makeProgress(event, 'take_screenshot')));

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
  ipcMain.handle('computer:get-email-config', async (event) =>
    executeToolDirect('get_email_config', {}, makeProgress(event, 'get_email_config')));

  ipcMain.handle('computer:configure-email', async (event, email: string, password: string) =>
    executeToolDirect('configure_email', { email, password }, makeProgress(event, 'configure_email')));

  ipcMain.handle('computer:send-email', async (event, to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) =>
    executeToolDirect('send_email', { to, subject, body, attachment_paths: attachmentPaths, is_html: isHtml }, makeProgress(event, 'send_email')));
}

// ─── Exported Tool Schemas for LLM (prevents TS2345 mismatch) ───────
export const SYSTEM_PROCESS_TOOLS: any[] = [
  {
    name: 'list_screens',
    description: 'Lista todas las pantallas (monitores) disponibles, devolviendo su id, name y display_id. Esto permite saber qué display_id pasar a take_screenshot.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_processes',
    description: 'Obtiene una lista de los 20 procesos que más CPU consumen en el sistema. Retorna pid, name, cpu, mem, command.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'kill_process',
    description: 'Termina (mata) un proceso del sistema usando su PID.',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'El ID del proceso (PID) a terminar.' }
      },
      required: ['pid']
    }
  }
];
