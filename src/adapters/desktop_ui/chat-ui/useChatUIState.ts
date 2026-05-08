import { useRef, useState } from 'react';
import type { UserTool } from '../../../services/tools-service';
import type { ConfirmationModalState, OptimizerTarget } from './types';

export function useChatUIState() {
  const [input, setInput] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [isPromptOptimizerMode, setIsPromptOptimizerMode] = useState(false);
  const [optimizerTarget, setOptimizerTarget] = useState<OptimizerTarget>('chatgpt');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isToolEditorOpen, setIsToolEditorOpen] = useState(false);
  const [isToolLibraryOpen, setIsToolLibraryOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<UserTool | null>(null);
  const [activeTool, setActiveTool] = useState<UserTool | null>(null);
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
    tools: { isOpen: isToolsOpen, setOpen: setIsToolsOpen },
    images: { selected: selectedImages, setSelected: setSelectedImages, zoomed: zoomedImage, setZoomed: setZoomedImage },
    modes: { imageGen: isImageGenMode, setImageGen: setIsImageGenMode, promptOptimizer: isPromptOptimizerMode, setPromptOptimizer: setIsPromptOptimizerMode, optimizerTarget, setOptimizerTarget },
    toolModals: { editorOpen: isToolEditorOpen, setEditorOpen: setIsToolEditorOpen, libraryOpen: isToolLibraryOpen, setLibraryOpen: setIsToolLibraryOpen, editingTool, setEditingTool, activeTool, setActiveTool, savePromptText, setSavePromptText },
    confirmation: { modal: confirmModal, setModal: setConfirmModal },
    header: { show: showHeader, setShow: setShowHeader, sticky: isSticky, setSticky: setIsSticky },
    editing: { messageId: editingMessageId, setMessageId: setEditingMessageId, value: editInput, setValue: setEditInput },
    refs: { messagesEndRef, lastScrollTopRef, fileInputRef },
  };
}
