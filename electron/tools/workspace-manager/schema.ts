import { z } from 'zod';

export const workspaceSchema: any = z.object({
  action: z.enum(['save', 'restore', 'list', 'delete']).describe('Accion a realizar: "save", "restore", "list" o "delete"'),
  name: z.string().optional().describe('Nombre del espacio de trabajo requerido para save, restore y delete.'),
});
