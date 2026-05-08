import { promises as fs } from 'node:fs';
import { FsCmdSchema } from './schemas';
import { isSafeWorkspacePath, resolveWorkspacePath } from './path-safety';

export async function handleFsCommand(args: string[], workspaceDir: string): Promise<string> {
  const parsed = FsCmdSchema.safeParse(args);
  if (!parsed.success) {
    return `[ERROR] Invalid /fs command.\nUsage:\n- /fs ls <path>\n- /fs rm <path>\n- /fs move <src> <dest>`;
  }

  const [, action, target, dest] = parsed.data;
  if (!isSafeWorkspacePath(workspaceDir, target)) {
    return `[SECURITY ERROR]: Path traversal detected for target: ${target}`;
  }

  try {
    if (action === 'ls') {
      return await listPath(target, resolveWorkspacePath(workspaceDir, target));
    }
    if (action === 'rm') {
      return await removePath(target, resolveWorkspacePath(workspaceDir, target));
    }
    if (action === 'move') {
      return await movePath(workspaceDir, target, dest);
    }
    return `[ERROR] Unknown /fs action: ${action}`;
  } catch (error: any) {
    return `[FS ERROR]: ${error.message}`;
  }
}

async function listPath(label: string, resolvedTarget: string): Promise<string> {
  try {
    const stats = await fs.stat(resolvedTarget);
    if (!stats.isDirectory()) {
      return `[INFO]: ${label} is a file.\nSize: ${stats.size} bytes\nModified: ${stats.mtime.toISOString()}`;
    }

    const items = await fs.readdir(resolvedTarget, { withFileTypes: true });
    if (items.length === 0) return `[Directory is empty]: ${label}`;

    const formatted = items.map((item) => `${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`);
    return `[Contents of ${label}]\n${formatted.join('\n')}`;
  } catch (err: any) {
    if (err.code === 'ENOENT') return `[ERROR]: Directory or file not found: ${label}`;
    throw err;
  }
}

async function removePath(label: string, resolvedTarget: string): Promise<string> {
  try {
    const stats = await fs.stat(resolvedTarget);
    if (stats.isDirectory()) {
      await fs.rm(resolvedTarget, { recursive: true, force: true });
    } else {
      await fs.unlink(resolvedTarget);
    }
    return `[SUCCESS]: Removed ${label}`;
  } catch (err: any) {
    if (err.code === 'ENOENT') return `[ERROR]: Target not found: ${label}`;
    throw err;
  }
}

async function movePath(workspaceDir: string, target: string, dest?: string): Promise<string> {
  if (!dest) {
    return `[ERROR]: /fs move requires a destination path.\nUsage: /fs move <src> <dest>`;
  }
  if (!isSafeWorkspacePath(workspaceDir, dest)) {
    return `[SECURITY ERROR]: Path traversal detected for destination: ${dest}`;
  }

  const resolvedTarget = resolveWorkspacePath(workspaceDir, target);
  const resolvedDest = resolveWorkspacePath(workspaceDir, dest);
  await fs.rename(resolvedTarget, resolvedDest);
  return `[SUCCESS]: Moved ${target} -> ${dest}`;
}
