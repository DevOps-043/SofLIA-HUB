import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';

const requireModule = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
const execAsync = promisify(exec);

// ─── REGLA ESTRICTA APLICADA ──────────────────────────────────────────────────────────
// El plan requería importar `@octokit/rest`, sin embargo, este paquete no se encuentra
// en `package.json`. Para cumplir estrictamente con la regla "PHANTOM IMPORTS PROHIBIDOS",
// implementamos la misma funcionalidad utilizando la API REST nativa de GitHub mediante `fetch`.
// ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Crea un Pull Request de forma autónoma usando la API REST de GitHub.
 *
 * @param branch Nombre de la rama head.
 * @param title Título del PR.
 * @param body Cuerpo/descripción del PR.
 * @param repoPath Ruta local del repositorio (default a process.cwd()).
 * @returns La URL del PR creado.
 */
export async function createAutonomousPR(
  branch: string,
  title: string,
  body: string,
  repoPath: string = process.cwd()
): Promise<string> {
  try {
    // 1. Obtener la URL del remote origin para deducir el owner/repo
    const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: repoPath });
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?\s*$/);
    if (!match) {
      throw new Error('No se pudo determinar el owner y repo de GitHub desde el remote origin.');
    }
    const owner = match[1];
    const repo = match[2];

    // 2. Obtener el token de autenticación
    let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      try {
        const { stdout: ghToken } = await execAsync('gh auth token', { cwd: repoPath });
        token = ghToken.trim();
      } catch {
        throw new Error('No se encontró GH_TOKEN en env ni se pudo obtener de gh CLI. Autentíquese con: gh auth login');
      }
    }

    // 3. Obtener la rama base (main o master)
    let base = 'main';
    try {
      const { stdout: baseBranch } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', { cwd: repoPath });
      base = baseBranch.trim().split('/').pop() || 'main';
    } catch {
      // Fallback
    }

    // 4. Crear el PR llamando a la API REST nativa de GitHub
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'SofLIA-Hub-AutoDev'
      },
      body: JSON.stringify({
        title,
        head: branch,
        base,
        body
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error de la API de GitHub: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.html_url;
  } catch (error: any) {
    throw new Error(`Fallo al crear PR autónomo: ${error.message}`);
  }
}

// ─── Declaración de la herramienta para el agente ──────────────────────────────

export const github_create_pr_declaration: FunctionDeclaration = {
  name: 'github_create_pr',
  description: 'Crea un Pull Request en GitHub programáticamente usando la API REST. Úsalo después de pushear una rama con mejoras autónomas.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      branch: { type: SchemaType.STRING, description: 'Nombre de la rama (head) que contiene los cambios ya pusheados.' },
      title: { type: SchemaType.STRING, description: 'Título del Pull Request.' },
      body: { type: SchemaType.STRING, description: 'Cuerpo/descripción del Pull Request en formato Markdown.' },
      repo_path: { type: SchemaType.STRING, description: 'Ruta local del repositorio git (opcional).' }
    },
    required: ['branch', 'title', 'body']
  }
};

// ─── Sistema de notificaciones proactivas vía WhatsApp ───────────────────────

function getUserDataPath(): string {
  const isElectron = typeof process !== 'undefined' && process.versions && !!process.versions.electron;
  let userDataPath = '';
  
  if (isElectron) {
    try {
      const electron = requireModule('electron');
      userDataPath = path.join(electron.app.getPath('userData'), '.autodev-data');
    } catch {
      userDataPath = path.join(process.cwd(), '.autodev-data');
    }
  } else {
    const appData = process.platform === 'win32'
      ? process.env.APPDATA
      : process.env.HOME + (process.platform === 'darwin' ? '/Library/Application Support' : '/.config');
    userDataPath = path.join(appData || '', 'soflia-hub-desktop', '.autodev-data');
  }
  return userDataPath;
}

/**
 * Encola un mensaje de WhatsApp para ser enviado por WhatsAppAgent/AutoDevService.
 */
function queueWhatsAppNotification(phone: string, message: string) {
  try {
    const userDataPath = getUserDataPath();

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const qPath = path.join(userDataPath, 'whatsapp-queue.json');
    let queue: any[] = [];
    if (fs.existsSync(qPath)) {
      queue = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    }
    queue.push({ phone, message });
    fs.writeFileSync(qPath, JSON.stringify(queue), 'utf8');
  } catch (err: any) {
    console.error('[AutoDev GitHub] WhatsApp queue error:', err.message);
  }
}

// ─── Handler de la herramienta ─────────────────────────────────────────────────

export async function handle_github_create_pr(args: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const repoPath = args.repo_path || process.cwd();
    const prUrl = await createAutonomousPR(args.branch, args.title, args.body, repoPath);
    
    // Si AutoDev tiene configuración, notificar por WhatsApp al usuario
    let phoneToNotify = null;
    try {
      const userDataPath = getUserDataPath();
      const configPath = path.join(userDataPath, 'autodev-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.notifyWhatsApp && config.notifyPhone) {
          phoneToNotify = config.notifyPhone;
        }
      }
    } catch (e) {
      console.warn('[AutoDev GitHub] No se pudo leer la configuración para notificación WhatsApp', e);
    }

    if (phoneToNotify) {
      const message = `🚀 *AutoDev PR Creado*\n\nHe implementado mejoras autónomas y he creado un Pull Request.\n\n*Título:* ${args.title}\n*Rama:* ${args.branch}\n\n🔗 Puedes revisarlo aquí:\n${prUrl}`;
      queueWhatsAppNotification(phoneToNotify, message);
    }

    return {
      success: true,
      data: {
        pr_url: prUrl,
        message: 'Pull Request creado exitosamente y notificación proactiva enviada a WhatsApp.'
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Exportar configuración empaquetada para el sandbox o registro
export const autodevGithubTools = [github_create_pr_declaration];
export const autodevGithubHandlers: Record<string, (args: any) => Promise<any>> = {
  github_create_pr: handle_github_create_pr
};
