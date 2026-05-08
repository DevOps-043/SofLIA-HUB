import type { ToolCategory, UserTool } from '../../services/tools-service';

export interface ToolEditorModalProps {
  isOpen: boolean;
  tool?: UserTool | null;
  initialPromptText?: string;
  onClose: () => void;
  onSave: (tool: UserTool) => void;
}

export interface ToolEditorFormState {
  name: string;
  description: string;
  icon: string;
  category: ToolCategory | '';
  systemPrompt: string;
  starterPrompts: string;
  saving: boolean;
  error: string | null;
}
