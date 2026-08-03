import type { UserTool } from '../../../services/tools-service';
import type { useChatUIState } from './useChatUIState';

export function useChatTools(
  canSendMessages: boolean,
  state: ReturnType<typeof useChatUIState>,
) {
  const handleToolSelect = (toolId: string) => {
    if (!canSendMessages) {
      state.tools.setOpen(false);
      return;
    }
    switch (toolId) {
      case 'attach_file':
        state.refs.fileInputRef.current?.click();
        break;
      case 'image_gen':
        state.modes.setImageGen((current) => !current);
        state.modes.setPromptOptimizer(false);
        break;
      case 'prompt_opt':
        state.modes.setPromptOptimizer((current) => !current);
        state.modes.setImageGen(false);
        break;
      case 'create_prompt':
        state.toolModals.setSavePromptText(state.input.value.trim());
        state.toolModals.setEditingTool(null);
        state.toolModals.setEditorOpen(true);
        break;
      case 'my_tools':
        state.toolModals.setLibraryOpen(true);
        break;
      default:
        break;
    }
    state.tools.setOpen(false);
  };

  const handleUseTool = (tool: UserTool) => {
    state.toolModals.setActiveTool(tool);
    state.toolModals.setLibraryOpen(false);
  };

  const handleEditTool = (tool: UserTool) => {
    state.toolModals.setEditingTool(tool);
    state.toolModals.setSavePromptText('');
    state.toolModals.setLibraryOpen(false);
    state.toolModals.setEditorOpen(true);
  };

  return { handleToolSelect, handleUseTool, handleEditTool };
}
