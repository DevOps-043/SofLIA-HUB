import type { ReactNode } from 'react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  toolName: string;
  description: string;
  /** Identidad efímera de revisión en renderer; no concede ni persiste permisos. */
  requestId?: number;
  onConfirm: () => void;
  onAlways?: () => void;
  onCancel: () => void;
}

export interface ToolMeta {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
}
