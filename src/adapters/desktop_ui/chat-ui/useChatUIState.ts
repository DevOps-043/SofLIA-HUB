import { useRef, useState } from 'react';
import type { ActiveSkillState } from '../../../services/skills/active-skill';
import type { UserSkill } from '../../../shared/skills/types';
import type { BrowserSelectionAttachment, ConfirmationModalState, OptimizerTarget } from './types';
import type { TabContextAttachment } from '../../../services/integrated-browser-service';

export function useChatUIState() {
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState<BrowserSelectionAttachment | null>(null);
  const [attachedTabs, setAttachedTabs] = useState<TabContextAttachment[]>([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [isPromptOptimizerMode, setIsPromptOptimizerMode] = useState(false);
  const [optimizerTarget, setOptimizerTarget] = useState<OptimizerTarget>('chatgpt');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isToolEditorOpen, setIsToolEditorOpen] = useState(false);
  const [isToolLibraryOpen, setIsToolLibraryOpen] = useState(false);
  // Solo se editan Skills del usuario: las del sistema se actualizan con el
  // producto y la biblioteca no ofrece editarlas.
  const [editingSkill, setEditingSkill] = useState<UserSkill | null>(null);
  const [activeSkill, setActiveSkill] = useState<ActiveSkillState | null>(null);
  const [savePromptText, setSavePromptText] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmationModalState | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [isSticky, setIsSticky] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return {
    input: { value: input, set: setInput },
    selection: { value: selection, set: setSelection },
    tabs: { attached: attachedTabs, setAttached: setAttachedTabs },
    tools: { isOpen: isToolsOpen, setOpen: setIsToolsOpen },
    images: { selected: selectedImages, setSelected: setSelectedImages, zoomed: zoomedImage, setZoomed: setZoomedImage },
    modes: { imageGen: isImageGenMode, setImageGen: setIsImageGenMode, promptOptimizer: isPromptOptimizerMode, setPromptOptimizer: setIsPromptOptimizerMode, optimizerTarget, setOptimizerTarget },
    skillModals: { editorOpen: isToolEditorOpen, setEditorOpen: setIsToolEditorOpen, libraryOpen: isToolLibraryOpen, setLibraryOpen: setIsToolLibraryOpen, editingSkill, setEditingSkill, activeSkill, setActiveSkill, savePromptText, setSavePromptText },
    confirmation: { modal: confirmModal, setModal: setConfirmModal },
    header: { show: showHeader, setShow: setShowHeader, sticky: isSticky, setSticky: setIsSticky },
    editing: { messageId: editingMessageId, setMessageId: setEditingMessageId, value: editInput, setValue: setEditInput },
    refs: { messagesEndRef, lastScrollTopRef, fileInputRef },
  };
}
