import type { DriveService } from '../drive-service';
import type { EmailMessage } from '../gmail-service';
import type { DriveFolderDefinition, WorkflowActionKind } from './types';

export function pickBestMessage(messages: EmailMessage[]): EmailMessage {
  const unread = messages.find((message) => message.isUnread);
  return unread || messages[0];
}

export function extractPrimaryEmailAddress(fromHeader: string): string | null {
  const angleMatch = String(fromHeader || '').match(/<([^>]+)>/);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim();
  }

  const directMatch = String(fromHeader || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return directMatch?.[0]?.trim() || null;
}

export function buildReplySubject(subject: string): string {
  const trimmed = String(subject || '').trim();
  if (!trimmed) {
    return 'Seguimiento';
  }
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function parseTargetDate(value: unknown): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00`);
  }
  return new Date();
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function sanitizeCapabilities(value: unknown): WorkflowActionKind[] {
  const allowed: WorkflowActionKind[] = [
    'desktop_task',
    'gchat_message',
    'gmail_reply',
    'gmail_send',
    'calendar_event',
    'gmail_labels',
    'drive_folder_tree',
  ];
  const incoming = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const normalized = incoming.filter((item): item is WorkflowActionKind =>
    allowed.includes(item as WorkflowActionKind),
  );
  return normalized.length > 0 ? normalized : ['desktop_task'];
}

export function buildDriveWorkspaceFolders(): DriveFolderDefinition[] {
  return [
    { name: '01 Direccion' },
    { name: '02 Operacion' },
    { name: '03 Comercial' },
    { name: '04 Entregables' },
    { name: '05 Finanzas' },
  ];
}

export function normalizeDriveFolderDefinition(value: unknown): DriveFolderDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as { name?: unknown; children?: unknown };
  const name = String(source.name || '').trim();
  if (!name) {
    return null;
  }

  const children = Array.isArray(source.children)
    ? source.children
        .map((item) => normalizeDriveFolderDefinition(item))
        .filter((item): item is DriveFolderDefinition => Boolean(item))
    : [];

  return children.length > 0 ? { name, children } : { name };
}

export function pickMeetingEvent(events: Array<{
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  source: 'google' | 'microsoft';
}>, targetDate: Date) {
  const sorted = events
    .slice()
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  if (sorted.length === 0) {
    return null;
  }

  const today = formatDateOnly(targetDate) === formatDateOnly(new Date());
  if (today) {
    const now = Date.now();
    return sorted.find((event) => event.end.getTime() >= now) || sorted[0];
  }

  return sorted[0];
}

export async function createDriveFolderTree(
  driveService: DriveService,
  parentFolderId: string,
  folders: DriveFolderDefinition[],
): Promise<Array<{ name: string; folderId: string; parentFolderId: string }>> {
  const created: Array<{ name: string; folderId: string; parentFolderId: string }> = [];

  for (const folder of folders) {
    const result = await driveService.createFolder(folder.name, parentFolderId);
    if (!result.success || !result.folderId) {
      throw new Error(result.error || `No se pudo crear la carpeta ${folder.name}.`);
    }

    created.push({
      name: folder.name,
      folderId: result.folderId,
      parentFolderId,
    });

    if (folder.children?.length) {
      const nested = await createDriveFolderTree(driveService, result.folderId, folder.children);
      created.push(...nested);
    }
  }

  return created;
}
