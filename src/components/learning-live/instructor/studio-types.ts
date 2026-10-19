import type { StudioCaptureBinding } from '../../../shared/studio-capture';
import type { StudioHolding } from '../../../shared/studio-program';
export type StudioMessage = {
  id: string;
  authorId: string;
  author: string;
  role: 'instructor' | 'participant' | 'soflia';
  text: string;
  time: string;
  question?: string;
  roomId?: string;
};
export type StudioResource = { id: string; name: string; detail: string; kind: 'file' | 'reading' | 'quiz' };
export type StudioExamples = {
  messages: StudioMessage[];
  resources: StudioResource[];
  participants: number;
  scenes?: StudioPreparedScene[];
};
export type StudioViewMode = 'screen' | 'camera' | 'combined';
export type StudioRoom = { id: string; name: string; participants: number };
export type StudioPreparedScene = {
  id: string;
  name: string;
  kind: 'slide' | 'screen' | 'image' | 'video' | 'holding';
  title: string;
  description: string;
  assetUrl?: string;
  fileName?: string;
  capture?: StudioCaptureBinding;
  holding?: StudioHolding;
};
export const STUDIO_COMMANDS = '/silenciar · /abrir · /reacciones · /soflia · /ayuda';
