import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normalizePath } from '../utils/file-utils';
import { getEmailConfigStatus, readEmailConfig, writeEmailConfig } from './email-config-store';
import { detectSmtp, validateEmailConfigInput, validateOutgoingEmailArgs } from './email-security';

const requireCjs = createRequire(import.meta.url);
const nodemailer = requireCjs('nodemailer');

export function handleGetEmailConfig(): Promise<{ success: boolean; configured: boolean; email?: string }> {
  return getEmailConfigStatus();
}

export async function handleConfigureEmail(args: Record<string, any>): Promise<Record<string, any>> {
  try {
    const { email, password } = validateEmailConfigInput(args);
    const smtp = detectSmtp(email);
    if (!smtp) {
      const domain = email.split('@')[1] || 'desconocido';
      return { success: false, error: `No se pudo detectar la configuraciÃ³n SMTP para "${domain}". Proveedores soportados: Gmail, Outlook, Hotmail, Yahoo, iCloud, ProtonMail, Zoho.` };
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: email, pass: password },
    });
    await transporter.verify();
    await writeEmailConfig({ host: smtp.host, port: smtp.port, user: email, password, defaultFrom: email });
    return { success: true, message: `Email configurado correctamente con ${email}.` };
  } catch (err: any) {
    return { success: false, error: `Error al verificar credenciales: ${err.message}. Para Gmail necesitas una "contraseÃ±a de aplicaciÃ³n" (no tu contraseÃ±a normal). Ve a myaccount.google.com > Seguridad > ContraseÃ±as de aplicaciones.` };
  }
}

export async function handleSendEmail(args: Record<string, any>, onProgress?: (message: string) => void): Promise<Record<string, any>> {
  try {
    const outgoing = validateOutgoingEmailArgs(args);
    onProgress?.(`Preparando envÃ­o de email a ${outgoing.to.join(', ')}...`);
    const config = await loadEmailConfig();
    const attachments = await buildAttachments(outgoing.attachmentPaths, onProgress);
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    const mailOptions: any = { from: config.defaultFrom || config.user, to: outgoing.to, subject: outgoing.subject, attachments };
    if (outgoing.isHtml) mailOptions.html = outgoing.body; else mailOptions.text = outgoing.body;
    onProgress?.('Enviando mensaje al servidor SMTP...');
    const info = await transporter.sendMail(mailOptions);
    onProgress?.('Email enviado con Ã©xito.');
    return { success: true, message: `Email enviado exitosamente a ${outgoing.to.join(', ')}`, messageId: info.messageId, to: outgoing.to, subject: outgoing.subject, attachmentsCount: attachments.length };
  } catch (err: any) {
    return { success: false, error: `Error al enviar email: ${err.message}` };
  }
}

async function loadEmailConfig() {
  try {
    return await readEmailConfig();
  } catch {
    throw new Error('Email no configurado. Pide al usuario su email y contraseÃ±a de aplicaciÃ³n, luego usa configure_email.');
  }
}

async function buildAttachments(paths: string[], onProgress?: (message: string) => void) {
  if (paths.length > 0) onProgress?.(`Cargando ${paths.length} archivos adjuntos...`);
  return Promise.all(paths.map(async (filePath) => {
    const resolved = normalizePath(filePath);
    await fs.stat(resolved);
    return { filename: path.basename(resolved), path: resolved };
  }));
}
