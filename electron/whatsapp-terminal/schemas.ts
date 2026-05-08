import { z } from 'zod';

export const SysCmdSchema = z.tuple([
  z.literal('/sys'),
  z.enum(['info', 'cpu', 'mem']),
]);

export const FsCmdSchema = z.tuple([
  z.literal('/fs'),
  z.enum(['ls', 'move', 'rm']),
  z.string(),
  z.string().optional(),
]);

export const ShellCmdSchema = z.tuple([
  z.literal('/shell'),
  z.string(),
]).rest(z.string());
