import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useChatProcessor } from '../../../hooks/useChatProcessor';
import { useModelSelector } from '../../../hooks/useModelSelector';
import { syncCurrentOwner } from '../../../services/memory-bridge';
import type { ChatUIProps, ProcessMessageHandler } from './types';
import type { useChatUIState } from './useChatUIState';
import type { ActiveSkillState } from '../../../services/skills/active-skill';

export function useChatRuntime(
  props: ChatUIProps,
  state: ReturnType<typeof useChatUIState>,
  /** Skill del turno ya resuelta: no siempre coincide con la del compositor. */
  activeSkill: ActiveSkillState | null,
) {
  const messagesRef = useRef(props.messages);
  const processMessageRef = useRef<ProcessMessageHandler | null>(null);
  const externalPromptProcessedRef = useRef<(() => void) | undefined>(props.onExternalPromptProcessed);
  const lastProcessedExternalPromptRef = useRef<string | null>(null);
  const externalSelectionProcessedRef = useRef<(() => void) | undefined>(props.onExternalSelectionProcessed);
  useEffect(() => { messagesRef.current = props.messages; }, [props.messages]);

  const model = useModelSelector();
  const { dataUserId } = useAuth();
  const [draftMemoryScope] = useState(() => `borrador:${crypto.randomUUID()}`);
  const memorySessionScope = props.conversationId?.trim() || draftMemoryScope;
  // Informa al main quién es el usuario activo (memoria unificada cross-superficie).
  useEffect(() => { syncCurrentOwner(dataUserId ?? null); }, [dataUserId]);
  const chat = useChatProcessor({
    messages: props.messages,
    onMessagesChange: props.onMessagesChange,
    personalization: props.personalization,
    sofiaUserId: dataUserId ?? undefined,
    preferredPrimaryModel: model.preferredPrimaryModel,
    thinkingMode: model.thinkingMode,
    isImageGenMode: state.modes.imageGen,
    isPromptOptimizerMode: state.modes.promptOptimizer,
    optimizerTarget: state.modes.optimizerTarget,
    activeSkill,
    memorySessionScope,
  });
  useEffect(() => { processMessageRef.current = chat.processMessage; }, [chat.processMessage]);
  // Los avisos de "ya procesado" viajan por ref para que un callback recreado en
  // cada render no vuelva a disparar los efectos de abajo.
  useEffect(() => {
    externalPromptProcessedRef.current = props.onExternalPromptProcessed;
    externalSelectionProcessedRef.current = props.onExternalSelectionProcessed;
  });

  useEffect(() => {
    if (!props.externalPrompt) {
      lastProcessedExternalPromptRef.current = null;
      return;
    }
    if (lastProcessedExternalPromptRef.current === props.externalPrompt) return;
    lastProcessedExternalPromptRef.current = props.externalPrompt;
    externalPromptProcessedRef.current?.();
    if (props.canSendMessages !== false) {
      processMessageRef.current?.(props.externalPrompt, [], messagesRef.current, false);
    }
  }, [props.canSendMessages, props.externalPrompt]);

  // La seleccion del navegador se adjunta al compositor y precarga la
  // instruccion sugerida. Nunca envia: el turno sale cuando el usuario lo manda.
  const setInput = state.input.set;
  const setSelection = state.selection.set;
  useEffect(() => {
    const selection = props.externalSelection;
    if (!selection) return;
    externalSelectionProcessedRef.current?.();
    // Un aviso sin texto significa que el usuario deshizo la seleccion.
    if (!selection.text.trim()) {
      setSelection(null);
      return;
    }
    setSelection(selection);
    if (selection.instruction) setInput(selection.instruction);
  }, [props.externalSelection, setInput, setSelection]);

  return { model, chat, messagesRef };
}
