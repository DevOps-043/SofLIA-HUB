import { useEffect } from 'react';
import type { UIEvent } from 'react';
import { setConfirmationHandler } from '../../../services/computer-use-service';
import { useAuth } from '../../../contexts/AuthContext';
import { usePresentationWorkspaceContext } from '../../../contexts/presentation-workspace-context';
import type { ChatUIProps } from './types';
import { useChatFileHandlers } from './useChatFileHandlers';
import { useChatRuntime } from './useChatRuntime';
import { useChatTools } from './useChatTools';
import { useChatUIState } from './useChatUIState';
import { useSkillCommands } from './useSkillCommands';
import { useSkillWorkspaceLink } from './useSkillWorkspaceLink';
import { useSkillWorkspaceResume } from './useSkillWorkspaceResume';
import { resolveTurnSkill } from './resolve-turn-skill';
import { useDictation } from './useDictation';
import { integratedBrowserService } from '../../../services/integrated-browser-service';
import { APP_CONTEXT_LIMITS, buildAppContextBlock, resolveAppAttachments } from './app-attachments';

export function useChatUIController(props: ChatUIProps) {
  const canSendMessages = props.canSendMessages ?? true;
  const normalizedProps = { ...props, canSendMessages };
  const state = useChatUIState();
  const files = useChatFileHandlers(canSendMessages, state.images.setSelected);
  const dictation = useDictation(state.input.set);
  const { sofiaContext } = useAuth();
  const presentation = usePresentationWorkspaceContext();
  // La Skill del turno se deriva del espacio de trabajo resuelto por la
  // conversacion, no solo del estado del compositor: ese estado no sobrevive a
  // un remonte y el modelo se quedaba sin herramientas de archivo.
  const turnSkill = resolveTurnSkill({
    activeSkill: state.skillModals.activeSkill,
    workspaceId: presentation.workspaceId,
    skillId: presentation.skillId,
  });
  const runtime = useChatRuntime(normalizedProps, state, turnSkill);
  const tools = useChatTools(canSendMessages, state, {
    conversationId: props.conversationId ?? null,
    organizationId: sofiaContext?.currentOrganization?.id ?? null,
    organizationName: sofiaContext?.currentOrganization?.name ?? null,
    // Senales que deciden por que rama del protocolo arranca la Skill: sin
    // ellas preguntaria por informacion que el usuario ya tiene delante.
    activation: {
      hasConversation: normalizedProps.messages.length > 0,
      hasBrowserPage: normalizedProps.browserOpen === true,
      hasAttachments: state.images.selected.length > 0 || state.selection.value !== null,
      organizationName: sofiaContext?.currentOrganization?.name ?? null,
    },
    onWorkspaceReady: presentation.activate,
  });
  // Una conversacion que ya tiene entregable recupera su Skill sola: sin esto,
  // pedir un cambio sobre la presentacion llegaba al modelo sin herramientas
  // de workspace y respondia que no tenia acceso a los archivos.
  useSkillWorkspaceResume({
    conversationId: props.conversationId ?? null,
    activeSkill: state.skillModals.activeSkill,
    setActiveSkill: state.skillModals.setActiveSkill,
    onWorkspaceResolved: presentation.restore,
  });
  // Y al reves: un chat nuevo no tiene conversacion cuando se activa la Skill,
  // asi que el workspace nace suelto. Se ata en cuanto el chat se guarda; sin
  // esto la presentacion no se podia reabrir al volver a la conversacion.
  useSkillWorkspaceLink({
    conversationId: props.conversationId ?? null,
    workspaceId: presentation.workspaceId,
  });
  // Comandos `/skill`: al activarlos se limpia el compositor, porque el
  // comando no es un mensaje que deba viajar al modelo.
  const skillCommands = useSkillCommands(state.input.value, (skill) => {
    state.input.set('');
    void tools.handleUseSkill(skill);
  });
  const setConfirmationModal = state.confirmation.setModal;

  useEffect(() => {
    setConfirmationHandler((toolName: string, description: string) => new Promise<boolean>((resolve) => {
      setConfirmationModal({ toolName, description, resolve });
    }));
    return () => setConfirmationHandler(null);
  }, [setConfirmationModal]);

  useEffect(() => {
    state.refs.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [normalizedProps.messages, state.refs.messagesEndRef]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const currentScrollTop = event.currentTarget.scrollTop;
    const delta = currentScrollTop - state.refs.lastScrollTopRef.current;
    if (currentScrollTop < 50) {
      state.header.setShow(true);
      state.header.setSticky(false);
    } else {
      state.header.setSticky(true);
      if (delta > 8) state.header.setShow(true);
      else if (delta < -8) state.header.setShow(false);
    }
    state.refs.lastScrollTopRef.current = currentScrollTop;
  };

  const onSendClick = async () => {
    if (!canSendMessages || !state.input.value.trim() || runtime.chat.showLoadingUI) return;
    // La burbuja lleva solo lo que escribio el usuario. La seleccion y las pestañas
    // adjuntas acompanan al turno como contexto para el modelo.
    const text = state.input.value.trim();
    const selContext = state.selection.value?.text.trim();

    const attached = state.tabs?.attached ?? [];
    const tabContextParts = await Promise.all(
      attached.map(async (tab, idx) => {
        let contentText = tab.text;
        if (!contentText && integratedBrowserService.isAvailable()) {
          try {
            const res = await integratedBrowserService.getTabContent(tab.tabId);
            if (res.success && res.content?.text) {
              contentText = res.content.text;
            }
          } catch {
            // fallback si no se puede leer la pestaña
          }
        }
        const header = `--- Pestaña ${idx + 1}: ${tab.title} (${tab.url}) ---`;
        const body = contentText ? contentText.slice(0, 4000) : '[Información de la pestaña cargada]';
        return `${header}\n${body}`;
      })
    );

    // Aplicaciones de escritorio: la lectura arrancó al marcarlas, así que aquí
    // solo se espera lo que siga en curso, con presupuesto acotado. Lo que no
    // llegue se declara como no leído en lugar de retener el turno.
    const attachedApps = state.apps?.attached ?? [];
    const resolvedApps = await resolveAppAttachments(
      attachedApps,
      state.apps?.extractions.current ?? new Map(),
    );

    // El presupuesto del turno es compartido: lo que ya gastaron las pestañas no
    // vuelve a estar disponible para las aplicaciones.
    const tabsCharCount = tabContextParts.reduce((total, part) => total + part.length, 0);
    const appBudget = Math.max(0, APP_CONTEXT_LIMITS.maxCharsPerTurn - tabsCharCount);
    const appContext = buildAppContextBlock(resolvedApps, appBudget);

    const combinedContextParts = [
      selContext ? `Selección del usuario:\n${selContext}` : '',
      tabContextParts.length > 0 ? `Pestañas del navegador adjuntas para análisis multi-pestaña:\n${tabContextParts.join('\n\n')}` : '',
      appContext.block ? `Aplicaciones abiertas del equipo adjuntas para análisis:\n${appContext.block}` : '',
    ].filter(Boolean);

    const contexto = combinedContextParts.length > 0 ? combinedContextParts.join('\n\n') : undefined;
    const images = [...state.images.selected, ...appContext.images];
    state.input.set('');
    state.selection.set(null);
    state.tabs?.setAttached([]);
    state.apps?.setAttached([]);
    state.apps?.extractions.current.clear();
    state.images.setSelected(() => []);
    await runtime.chat.handleSend(text, images, contexto);
  };

  // Detiene la generación de texto y cualquier proceso de Computer Use en curso.
  const onStopClick = () => runtime.chat.stopGeneration();

  return {
    props: normalizedProps,
    state,
    runtime,
    files,
    dictation,
    tools,
    skillCommands,
    refs: state.refs,
    handleScroll,
    onSendClick,
    onStopClick,
  };
}

export type ChatUIController = ReturnType<typeof useChatUIController>;
