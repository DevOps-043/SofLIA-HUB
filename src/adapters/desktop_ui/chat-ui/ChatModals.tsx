import { ConfirmActionModal } from '../../../components/ConfirmActionModal';
import { SkillEditorModal } from '../../../components/skills-settings/SkillEditorModal';
import { SkillLibrary } from '../../../components/SkillLibrary';
import { ImageZoomModal } from './ImageZoomModal';
import type { ChatUIController } from './useChatUIController';

export function ChatModals({ controller }: { controller: ChatUIController }) {
  const modals = controller.state.skillModals;
  const confirmation = controller.state.confirmation.modal;

  const closeSkillEditor = () => {
    modals.setEditorOpen(false);
    modals.setEditingSkill(null);
    modals.setSavePromptText('');
  };

  return (
    <>
      <SkillEditorModal
        isOpen={modals.editorOpen}
        skill={modals.editingSkill}
        initialInstructions={modals.savePromptText}
        onClose={closeSkillEditor}
        onSaved={closeSkillEditor}
      />
      <SkillLibrary
        isOpen={modals.libraryOpen}
        onClose={() => modals.setLibraryOpen(false)}
        onUseSkill={(skill) => void controller.tools.handleUseSkill(skill)}
        onEditSkill={controller.tools.handleEditSkill}
      />
      <ImageZoomModal image={controller.state.images.zoomed} onClose={() => controller.state.images.setZoomed(null)} />
      <ConfirmActionModal
        isOpen={!!confirmation}
        toolName={confirmation?.toolName || ''}
        description={confirmation?.description || ''}
        requestId={confirmation?.requestId}
        onAlways={confirmation?.allowAlways ? () => {
          confirmation.resolve('always');
        } : undefined}
        onConfirm={() => {
          confirmation?.resolve(true);
        }}
        onCancel={() => {
          confirmation?.resolve(false);
        }}
      />
    </>
  );
}
