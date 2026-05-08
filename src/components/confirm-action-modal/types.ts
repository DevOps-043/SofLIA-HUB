import type { ReactNode } from 'react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  toolName: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ToolMeta {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
}
