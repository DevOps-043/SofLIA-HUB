import { ConfirmActionModal } from '../../../components/ConfirmActionModal';
import { ToolEditorModal } from '../../../components/ToolEditorModal';
import { ToolLibrary } from '../../../components/ToolLibrary';
import { ImageZoomModal } from './ImageZoomModal';
import type { ChatUIController } from './useChatUIController';

export function ChatModals({ controller }: { controller: ChatUIController }) {
  const modals = controller.state.toolModals;
  const confirmation = controller.state.confirmation;

  const closeToolEditor = () => {
    modals.setEditorOpen(false);
    modals.setEditingTool(null);
    modals.setSavePromptText('');
  };

  return (
    <>
      <ToolEditorModal
        isOpen={modals.editorOpen}
        tool={modals.editingTool}
        initialPromptText={modals.savePromptText}
        onClose={closeToolEditor}
        onSave={closeToolEditor}
      />
      <ToolLibrary
        isOpen={modals.libraryOpen}
        onClose={() => modals.setLibraryOpen(false)}
        onUseTool={controller.tools.handleUseTool}
        onEditTool={controller.tools.handleEditTool}
      />
      <ImageZoomModal image={controller.state.images.zoomed} onClose={() => controller.state.images.setZoomed(null)} />
      <ConfirmActionModal
        isOpen={!!confirmation.modal}
        toolName={confirmation.modal?.toolName || ''}
        description={confirmation.modal?.description || ''}
        onConfirm={() => {
          confirmation.modal?.resolve(true);
          confirmation.setModal(null);
        }}
        onCancel={() => {
          confirmation.modal?.resolve(false);
          confirmation.setModal(null);
        }}
      />
    </>
  );
}
