import type { UserTool } from '../../services/tools-service';

export interface ToolLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTool: (tool: UserTool) => void;
  onEditTool: (tool: UserTool) => void;
}

export interface ToolLibraryItemProps {
  tool: UserTool;
  onUse: (tool: UserTool) => void;
  onEdit: (tool: UserTool) => void;
  onDelete: (id: string) => void;
}
