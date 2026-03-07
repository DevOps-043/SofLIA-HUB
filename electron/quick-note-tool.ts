import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import crypto from 'node:crypto';

export interface Note {
  id: string;
  text: string;
  tags: string[];
  timestamp: string;
}

export const getNotesPath = (): string => {
  return path.join(os.homedir(), '.soflia', 'notes.json');
};

const ensureDirectoryExists = async (filePath: string): Promise<void> => {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

export const loadNotes = async (): Promise<Note[]> => {
  const notesPath = getNotesPath();
  try {
    const data = await fs.readFile(notesPath, 'utf-8');
    return JSON.parse(data) as Note[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

export const saveNote = async (text: string, tags: string[] = []): Promise<Note> => {
  const notesPath = getNotesPath();
  await ensureDirectoryExists(notesPath);
  
  const notes = await loadNotes();
  
  const newNote: Note = {
    id: crypto.randomUUID(),
    text,
    tags,
    timestamp: new Date().toISOString()
  };
  
  notes.push(newNote);
  
  const tempPath = `${notesPath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  
  await fs.writeFile(tempPath, JSON.stringify(notes, null, 2), 'utf-8');
  await fs.rename(tempPath, notesPath);
  
  return newNote;
};

export const searchNotes = async (query: string, tag?: string): Promise<Note[]> => {
  const notes = await loadNotes();
  
  const lowerQuery = query.toLowerCase();
  const lowerTag = tag?.toLowerCase();
  
  return notes.filter((note) => {
    const matchesQuery = !query || note.text.toLowerCase().includes(lowerQuery);
    const matchesTag = !tag || note.tags.some(t => t.toLowerCase() === lowerTag);
    return matchesQuery && matchesTag;
  });
};

export const SaveNoteSchema = z.object({
  text: z.string().describe('El contenido de la nota'),
  tags: z.array(z.string()).default([]).describe('Etiquetas para clasificar la nota')
});

export const SearchNotesSchema = z.object({
  query: z.string().describe('Texto a buscar dentro de las notas'),
  tag: z.string().optional().describe('Etiqueta específica para filtrar')
});

export const quickNoteSchemas = {
  saveNote: SaveNoteSchema,
  searchNotes: SearchNotesSchema
};
