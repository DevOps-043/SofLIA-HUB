import path from 'node:path';

export function resolveWorkspacePath(workspaceDir: string, targetPath: string): string {
  return path.resolve(workspaceDir, targetPath);
}

export function isSafeWorkspacePath(workspaceDir: string, targetPath: string): boolean {
  const resolvedPath = resolveWorkspacePath(workspaceDir, targetPath);
  return resolvedPath.startsWith(workspaceDir);
}
