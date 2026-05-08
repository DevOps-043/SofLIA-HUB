export interface SourcesPanelProps {
  parentId: string;
  parentType: 'folder' | 'conversation';
  userId: string;
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
}
