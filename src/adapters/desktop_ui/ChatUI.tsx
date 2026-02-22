import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessageStream, optimizePrompt, type ToolCallInfo } from '../../services/gemini-chat';
import { generateImage } from '../../services/image-generation';
import { ToolEditorModal } from '../../components/ToolEditorModal';
import { ToolLibrary } from '../../components/ToolLibrary';
import { ConfirmActionModal } from '../../components/ConfirmActionModal';
import { LiveClient, AudioCapture } from '../../services/live-api';
import { setConfirmationHandler } from '../../services/computer-use-service';
import type { UserTool } from '../../services/tools-service';
import type { ChatMessage } from '../../services/chat-service';
import { buildIrisContext, needsIrisData } from '../../services/iris-data';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  list_directory: 'Listando archivos...',
  read_file: 'Leyendo archivo...',
  write_file: 'Escribiendo archivo...',
  create_directory: 'Creando carpeta...',
  move_item: 'Moviendo...',
  copy_item: 'Copiando...',
  delete_item: 'Eliminando...',
  get_file_info: 'Obteniendo info...',
  search_files: 'Buscando archivos...',
  execute_command: 'Ejecutando comando...',
  open_application: 'Abriendo aplicación...',
  open_url: 'Abriendo URL...',
  get_system_info: 'Info del sistema...',
  clipboard_read: 'Leyendo portapapeles...',
  clipboard_write: 'Copiando al portapapeles...',
  take_screenshot: 'Capturando pantalla...',
  get_email_config: 'Verificando email...',
  configure_email: 'Configurando email...',
  send_email: 'Enviando email...',
};

interface ChatUIProps {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  personalization?: {
    nickname?: string;
    occupation?: string;
    tone?: string;
    instructions?: string;
  };
  userAvatar?: string | null;
  externalPrompt?: string | null;
  onExternalPromptProcessed?: () => void;
}
export const ChatUI: React.FC<ChatUIProps> = ({ messages, onMessagesChange, personalization, userAvatar, externalPrompt, onExternalPromptProcessed }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Tools state
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [isPromptOptimizerMode, setIsPromptOptimizerMode] = useState(false);
  const [optimizerTarget, setOptimizerTarget] = useState<'chatgpt' | 'claude' | 'gemini'>('chatgpt');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isToolEditorOpen, setIsToolEditorOpen] = useState(false);
  const [isToolLibraryOpen, setIsToolLibraryOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<UserTool | null>(null);
  const [activeTool, setActiveTool] = useState<UserTool | null>(null);
  const [savePromptText, setSavePromptText] = useState<string>('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallInfo | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    toolName: string;
    description: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const liveClientRef = useRef<LiveClient | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Register custom confirmation handler for computer-use actions
  useEffect(() => {
    setConfirmationHandler((toolName: string, description: string) => {
      return new Promise<boolean>((resolve) => {
        setConfirmModal({ toolName, description, resolve });
      });
    });
    return () => setConfirmationHandler(null);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle external prompts (e.g. clicking on an IRIS project or flow mode)
  useEffect(() => {
    if (externalPrompt) {
      const processExternal = async () => {
        if (onExternalPromptProcessed) {
          onExternalPromptProcessed();
        }
        await processMessage(externalPrompt, [], messagesRef.current, false);
      };
      processExternal();
    }
  }, [externalPrompt]);

  // Thinking Options - Different for Gemini 3 (thinkingLevel) vs Gemini 2.5 (thinkingBudget)
  // Gemini 3 Flash - supports all levels
  const THINKING_OPTIONS_GEMINI3_FLASH = [
    { id: 'minimal', name: 'Rápido', desc: 'Responde rápidamente', level: 'minimal' },
    { id: 'low', name: 'Pensar', desc: 'Razonamiento básico', level: 'low' },
    { id: 'medium', name: 'Medio', desc: 'Razonamiento balanceado', level: 'medium' },
    { id: 'high', name: 'Alto', desc: 'Máximo razonamiento', level: 'high' },
  ];

  // Gemini 3 Pro - only supports low and high
  const THINKING_OPTIONS_GEMINI3_PRO = [
    { id: 'low', name: 'Pensar', desc: 'Razonamiento básico', level: 'low' },
    { id: 'high', name: 'Pro', desc: 'Máximo razonamiento', level: 'high' },
  ];

  // Gemini 2.5 - uses token budget
  const THINKING_OPTIONS_GEMINI25 = [
    { id: 'off', name: 'Rápido', desc: 'Sin pensamiento', budget: 0 },
    { id: 'low', name: 'Pensar', desc: 'Pensamiento ligero', budget: 1024 },
    { id: 'medium', name: 'Medio', desc: 'Pensamiento moderado', budget: 8192 },
    { id: 'high', name: 'Alto', desc: 'Pensamiento profundo', budget: 24576 },
  ];

  const MODEL_OPTIONS = [
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3.0 Flash',
      desc: 'Equilibrio perfecto entre velocidad y calidad.',
      thinkingType: 'level',
      thinkingOptions: THINKING_OPTIONS_GEMINI3_FLASH
    },
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini 3 Pro',
      desc: 'Mayor capacidad de razonamiento lógico.',
      thinkingType: 'level',
      thinkingOptions: THINKING_OPTIONS_GEMINI3_PRO
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      desc: 'Ultra rápido y ligero para tareas simples.',
      thinkingType: 'budget',
      thinkingOptions: THINKING_OPTIONS_GEMINI25
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      desc: 'Modelo de máxima inteligencia.',
      thinkingType: 'budget',
      thinkingOptions: THINKING_OPTIONS_GEMINI25
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      desc: 'Versión estable anterior.',
      thinkingType: 'budget',
      thinkingOptions: THINKING_OPTIONS_GEMINI25
    }
  ];

  const [preferredPrimaryModel, setPreferredPrimaryModel] = useState<string>('gemini-3-flash-preview');
  const [thinkingMode, setThinkingMode] = useState<string>('minimal');
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  // Handle Dynamic Header (Hide on scroll up, show on scroll down)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    
    // Determine if we should show header based on direction
    // In chat, "up" (decreasing scrollTop) means going to history -> HIDE
    // In chat, "down" (increasing scrollTop) means going to newest -> SHOW
    if (currentScrollTop < 50) {
      setShowHeader(true);
      setIsSticky(false);
    } else {
      setIsSticky(true);
      if (currentScrollTop > lastScrollTop) {
        setShowHeader(true);
      } else {
        setShowHeader(false);
      }
    }
    
    setLastScrollTop(currentScrollTop);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsThinkingDropdownOpen(false);
      setIsModelSelectorOpen(false);
    };
    
    if (isThinkingDropdownOpen || isModelSelectorOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isThinkingDropdownOpen, isModelSelectorOpen]);

  // Handle Model Change and Adapt Thinking Mode
  const handleModelChange = (modelId: string) => {
    setPreferredPrimaryModel(modelId);
    
    // Adapt thinking mode
    const newModel = MODEL_OPTIONS.find(m => m.id === modelId);
    if (newModel) {
      const isGemini3 = newModel.thinkingType === 'level';
      const availableOptions = newModel.thinkingOptions.map((o: any) => o.id);

      // If current mode is not available in new model, adapt it
      if (!availableOptions.includes(thinkingMode)) {
        if (modelId === 'gemini-3-pro-preview') {
          // G3 Pro only has low/high
          setThinkingMode('low');
        } else if (!isGemini3 && thinkingMode === 'minimal') {
          // G2.5 minimal -> off
          setThinkingMode('off');
        } else if (isGemini3 && thinkingMode === 'off') {
          // G3 off -> minimal
          setThinkingMode('minimal');
        }
      }
    }
    setIsModelSelectorOpen(false);
  };

  const handleThinkingChange = (mode: string) => {
    setThinkingMode(mode);
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Paste image handler
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Live API handlers
  const startLiveConversation = async () => {
    if (isLiveActive) {
      stopLiveConversation();
      return;
    }

    setIsLiveConnecting(true);
    try {
      const client = new LiveClient({
        onTextResponse: (text) => {
          const liveMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'model',
            text,
            timestamp: Date.now(),
          };
          onMessagesChange([...messagesRef.current, liveMsg]);
        },
        onAudioResponse: () => { /* audio plays automatically in LiveClient */ },
        onError: (err) => {
          console.error('Live API error:', err);
        },
        onClose: () => {
          setIsLiveActive(false);
          audioCaptureRef.current?.stop();
          audioCaptureRef.current = null;
        },
        onReady: () => {
          setIsLiveActive(true);
          setIsLiveConnecting(false);
        },
      });

      await client.connect();
      liveClientRef.current = client;

      // Start audio capture
      const capture = new AudioCapture();
      await capture.start((base64) => {
        client.sendAudioChunk(base64);
      });
      audioCaptureRef.current = capture;

    } catch (err: any) {
      console.error('Live API connect error:', err);
      setIsLiveConnecting(false);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `**Error**: ${err.message}`,
        timestamp: Date.now(),
      };
      onMessagesChange([...messagesRef.current, errorMsg]);
    }
  };

  const stopLiveConversation = () => {
    audioCaptureRef.current?.stop();
    audioCaptureRef.current = null;
    liveClientRef.current?.disconnect();
    liveClientRef.current = null;
    setIsLiveActive(false);
    setIsLiveConnecting(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioCaptureRef.current?.stop();
      liveClientRef.current?.disconnect();
    };
  }, []);

  // Tool selection handler
  const handleToolSelect = (toolId: string) => {
    switch (toolId) {
      case 'attach_file':
        fileInputRef.current?.click();
        break;
      case 'image_gen':
        setIsImageGenMode(prev => !prev);
        setIsPromptOptimizerMode(false);
        break;
      case 'prompt_opt':
        setIsPromptOptimizerMode(prev => !prev);
        setIsImageGenMode(false);
        break;
      case 'create_prompt':
        setSavePromptText(input.trim());
        setEditingTool(null);
        setIsToolEditorOpen(true);
        break;
      case 'my_tools':
        setIsToolLibraryOpen(true);
        break;
      case 'live_api':
        startLiveConversation();
        break;
      default:
        console.log('Tool selected:', toolId);
        break;
    }
    setIsToolsOpen(false);
  };

  const handleUseTool = (tool: UserTool) => {
    setActiveTool(tool);
    setIsToolLibraryOpen(false);
  };

  const handleEditTool = (tool: UserTool) => {
    setEditingTool(tool);
    setSavePromptText('');
    setIsToolLibraryOpen(false);
    setIsToolEditorOpen(true);
  };

  const processMessage = async (
    text: string,
    images: string[],
    currentHistory: ChatMessage[],
    isRegeneration: boolean = false
  ) => {
    setIsLoading(true);

    // If regeneration, we assume the user message is already in history (last item)
    // If normal send, we need to append user message and placeholder
    
    let updatedMessages = [...currentHistory];
    
    // Normal Send: Add user message and placeholder
    let aiMessageId = crypto.randomUUID();
    
    if (!isRegeneration) {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: text,
        timestamp: Date.now(),
        images: images.length > 0 ? [...images] : undefined,
      };
      
      const aiPlaceholder: ChatMessage = {
        id: aiMessageId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
      };
      
      updatedMessages = [...currentHistory, userMessage, aiPlaceholder];
      onMessagesChange(updatedMessages);
    } else {
       // Regeneration: Add placeholder only
       // (User message should already be at the end of currentHistory)
       const aiPlaceholder: ChatMessage = {
        id: aiMessageId,
        role: 'model',
        text: '',
        timestamp: Date.now(),
      };
      updatedMessages = [...currentHistory, aiPlaceholder];
      onMessagesChange(updatedMessages);
    }
    
    try {
      // === PROMPT OPTIMIZER MODE ===
      if (isPromptOptimizerMode) {
        const optimized = await optimizePrompt(text, optimizerTarget);
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: optimized } : msg
          )
        );
        return;
      }

      // === IMAGE GENERATION MODE ===
      if (isImageGenMode) {
        const result = await generateImage(text);
        const resultImages = result.imageData ? [result.imageData] : undefined;
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: result.text, images: resultImages } : msg
          )
        );
        return;
      }

      // === NORMAL CHAT (with optional attached images) ===
      // Prepare history for API (exclude the placeholder we just added)
      // Gemini expects { role, text }
      // We need to make sure we don't send the empty placeholder or duplicate user messages
      
      // Filter out the placeholder we just added for the API call
      const cleanHistory = updatedMessages
        .filter(m => m.id !== aiMessageId)
        .map(m => ({
          role: m.role,
          text: m.text,
        }));

      const activeModel = MODEL_OPTIONS.find(m => m.id === preferredPrimaryModel);
      const thinkingOption = activeModel?.thinkingOptions.find((o: any) => o.id === thinkingMode);

      const irisContext = needsIrisData(text) ? await buildIrisContext() : undefined;

      const result = await sendMessageStream(text, cleanHistory, {
        model: preferredPrimaryModel,
        thinking: thinkingOption,
        personalization,
        images: images.length > 0 ? images : undefined,
        toolSystemPrompt: activeTool?.system_prompt,
        irisContext,
        onToolCall: (toolCall) => {
          setActiveToolCall(toolCall);
        },
      });

      let fullText = '';
      for await (const chunk of result.stream) {
        fullText += chunk;
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: fullText } : msg
          )
        );
      }

      const sources = await result.sources;
      if (sources && sources.length > 0) {
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: fullText, sources } : msg
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorText = error instanceof Error ? error.message : 'Error desconocido';
      onMessagesChange(
        updatedMessages.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, text: `**Error**: ${errorText}` }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setActiveToolCall(null);
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    // If Live API is active, send text through WebSocket instead
    if (isLiveActive && liveClientRef.current) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: input.trim(),
        timestamp: Date.now(),
      };
      onMessagesChange([...messages, userMsg]);
      liveClientRef.current.sendText(input.trim());
      setInput('');
      return;
    }

    const text = input.trim();
    const images = [...selectedImages];
    const history = [...messages];
    
    setInput('');
    setSelectedImages([]);
    
    // Self-learn: Send message to AutoDev to check for complaints/suggestions
    if ((window as any).autodev?.logFeedback) {
      (window as any).autodev.logFeedback(text).catch(console.error);
    }
    
    await processMessage(text, images, history, false);

  }, [input, isLoading, messages, onMessagesChange, preferredPrimaryModel, thinkingMode, personalization, selectedImages, isImageGenMode, isPromptOptimizerMode, optimizerTarget, activeTool, isLiveActive]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleFeedback = (index: number, type: 'like' | 'dislike') => {
    const updated = messages.map((msg, i) => {
      if (i === index) {
        return { 
          ...msg, 
          feedback: msg.feedback === type ? undefined : type 
        };
      }
      return msg;
    });
    onMessagesChange(updated);
  };

  const handleRegenerate = async (index: number) => {
    if (isLoading) return;

    // Find the user message preceding this assistant message
    const historyUpToNow = messages.slice(0, index);
    const lastUserMsgIndex = historyUpToNow.map(m => m.role).lastIndexOf('user');
    
    if (lastUserMsgIndex !== -1) {
       const userMsg = historyUpToNow[lastUserMsgIndex];
       
       // Keep history UP TO the user message (inclusive)
       const newHistory = messages.slice(0, lastUserMsgIndex + 1);
       
       // Update UI to remove old response
       onMessagesChange(newHistory);
       
       // Trigger processMessage with isRegeneration=true
       // Note: userMsg.images are already in the history item, 
       // but processMessage expects separate images arg for the 'current turn'.
       // However, since we set isRegeneration=true, processMessage relies on history for context.
       // EXCEPT: The underlying `sendMessageStream` might expect the prompt text and images separately if it's the 'active' prompt.
       // In `processMessage` above:
       //   const cleanHistory = updatedMessages... (includes the user message)
       //   sendMessageStream(text, cleanHistory...)
       // So it should work fine, as the last message in `cleanHistory` is the user prompt.
       
       // We pass userMsg.images just in case logic needs it, though strictly for chat history it's embedded.
       await processMessage(userMsg.text, userMsg.images || [], newHistory, true);
    }
  };

  const currentModel = MODEL_OPTIONS.find(m => m.id === preferredPrimaryModel);
  const currentThinkingOption = currentModel?.thinkingOptions.find((o: any) => o.id === thinkingMode);

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark relative">
      
      <div 
        className="flex-1 overflow-y-auto no-scrollbar flex flex-col"
        onScroll={handleScroll}
      >
        {/* HEADER TOP - Minimalist Model Selector (Dynamic Sticky) */}
        <div className={`sticky top-0 z-30 w-full transition-all duration-300 ${isSticky ? 'bg-background/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm py-3' : 'pt-6 pb-2'} ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
          <div className="w-full px-6 shrink-0">
            <div className="relative inline-block">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsModelSelectorOpen(!isModelSelectorOpen);
              }}
              className="flex items-center gap-2 text-lg font-medium text-primary dark:text-white/90 hover:text-accent transition-colors group"
            >
              <span>{currentModel?.name}</span>
              <span className="text-secondary text-sm font-normal opacity-60 group-hover:opacity-100 transition-opacity">
                {currentThinkingOption?.name || 'Rápido'}
              </span>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={`text-gray-400 transition-transform duration-200 ${isModelSelectorOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Model Selector Dropdown */}
            {isModelSelectorOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-30">
                <div className="p-2 space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Modelos Disponibles
                  </div>
                  {MODEL_OPTIONS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg flex items-start gap-3 transition-colors ${
                        preferredPrimaryModel === model.id 
                          ? 'bg-accent/10 dark:bg-white/5' 
                          : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className={`mt-0.5 ${preferredPrimaryModel === model.id ? 'text-accent' : 'text-gray-400'}`}>
                        {/* Checkmark or Circle */}
                        {preferredPrimaryModel === model.id ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          <div className="w-[18px] h-[18px]"></div>
                        )}
                      </div>
                      <div>
                        <div className={`font-medium text-sm ${preferredPrimaryModel === model.id ? 'text-accent' : 'text-primary dark:text-white'}`}>
                          {model.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {model.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Thinking Mode Sub-selector */}
                <div className="border-t border-gray-200 dark:border-white/10 p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Nivel de Razonamiento</span>
                    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                      {currentThinkingOption?.name}
                    </span>
                  </div>
                  <div className="flex gap-1 p-1">
                    {currentModel?.thinkingOptions.map((opt: any) => {
                      const isActive = thinkingMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleThinkingChange(opt.id)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                            isActive 
                              ? 'bg-accent text-white shadow-sm' 
                              : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10'
                          }`}
                          title={opt.desc}
                        >
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Empty State / Messages Area */}
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="mb-6">
              <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4 rounded-full overflow-hidden">
                <img src="/assets/lia-avatar.png" alt="SofLIA" className="w-full h-full object-cover drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
              </div>
              <h2 className="text-2xl font-semibold text-primary dark:text-white text-center">
                Como puedo ayudarte hoy?
              </h2>
              <p className="text-secondary text-sm text-center mt-2">
                Preguntale a SofLIA lo que necesites.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, index) => {
              // Si es el último mensaje, es del modelo, está vacio y está cargando, lo ocultamos
              // porque se mostrará el indicador de carga dedicado abajo
              if (isLoading && index === messages.length - 1 && msg.role === 'model' && !msg.text) {
                return null;
              }
              
              return (
                <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden">
                      <img src="/assets/lia-avatar.png" alt="SOFLIA" className="w-full h-full object-cover" />
                    </div>
                  )}
                  
                  <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Attached images (user) */}
                    {msg.role === 'user' && msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`Adjunto ${imgIdx + 1}`}
                            className="max-w-[200px] max-h-[150px] rounded-xl object-cover cursor-pointer hover:opacity-80 transition-opacity border border-white/20"
                            onClick={() => setZoomedImage(img)}
                          />
                        ))}
                      </div>
                    )}

                    <div className={`${
                      msg.role === 'user'
                        ? 'px-4 py-2.5 rounded-2xl bg-[#0A2540] text-white rounded-tr-sm shadow-sm'
                        : 'p-0 bg-transparent border-none shadow-none text-gray-800 dark:text-gray-100'
                    } text-[15px] leading-relaxed`}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <MarkdownRenderer text={msg.text} />
                      )}
                    </div>

                    {/* Generated/response images (model) */}
                    {msg.role === 'model' && msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`Imagen generada ${imgIdx + 1}`}
                            className="max-w-[400px] max-h-[400px] rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity border border-white/10 shadow-lg"
                            onClick={() => setZoomedImage(img)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Sources / Grounding */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.sources.map((source, i) => (
                          <a
                            key={i}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-white/5 hover:bg-accent/10 hover:border-accent/20 hover:text-accent transition-all no-underline"
                            title={source.snippet || source.title}
                          >
                            <div className="w-3.5 h-3.5 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                              <img 
                                src={`https://www.google.com/s2/favicons?domain=${new URL(source.uri).hostname}&sz=32`} 
                                className="w-full h-full object-contain"
                                alt=""
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            </div>
                            <span className="truncate max-w-[140px]">{source.title || 'Source'}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Message Actions (ChatGPT Style) */}
                    {msg.role === 'model' && (
                      <div className="flex gap-0.5 mt-1.5 select-none">
                        <button 
                          className="w-6 h-6 flex items-center justify-center rounded text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                          title="Copiar texto" 
                          onClick={() => handleCopy(msg.text)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        
                        <button 
                          className="w-6 h-6 flex items-center justify-center rounded text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
                          title="Regenerar respuesta" 
                          onClick={() => handleRegenerate(index)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 1 8.51 15"></path></svg>
                        </button>
                        
                        <button 
                          className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                            msg.feedback === 'like' 
                              ? 'text-[#8ab4f8]' 
                              : 'text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                          title="Me gusta" 
                          onClick={() => handleFeedback(index, 'like')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        </button>
                        
                        <button 
                          className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                            msg.feedback === 'dislike' 
                              ? 'text-[#e57373]' 
                              : 'text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                          title="No me gusta" 
                          onClick={() => handleFeedback(index, 'dislike')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.31 2.31H17"></path></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                     <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden" title="Usuario">
                        <UserAvatar 
                          src={userAvatar} 
                          fallback={<div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-700">Tú</div>} 
                        />
                     </div>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden">
                  <img src="/assets/lia-avatar.png" alt="SOFLIA" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  {activeToolCall && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl animate-in fade-in duration-300">
                      <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-accent">
                        {TOOL_DISPLAY_NAMES[activeToolCall.name] || activeToolCall.name}
                      </span>
                      {activeToolCall.args?.path && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{activeToolCall.args.path}</span>
                      )}
                      {activeToolCall.args?.command && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[200px] font-mono">{activeToolCall.args.command}</span>
                      )}
                    </div>
                  )}
                  {!activeToolCall && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>

      {/* Input Area */}
      <div className="relative z-10 pb-6 pt-2 px-4 bg-white dark:bg-background-dark shrink-0">
        <div className="max-w-3xl mx-auto w-full">
          {/* Active Mode Badges */}
          {(isImageGenMode || isPromptOptimizerMode || activeTool || isLiveActive || isLiveConnecting) && (
            <div className="mb-2 flex items-center gap-2">
              {isImageGenMode && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Modo Imagen
                  <button onClick={() => setIsImageGenMode(false)} className="ml-1 hover:text-purple-700 dark:hover:text-purple-200">x</button>
                </span>
              )}
              {isPromptOptimizerMode && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Mejorar Prompt
                    <button onClick={() => setIsPromptOptimizerMode(false)} className="ml-1 hover:text-emerald-700 dark:hover:text-emerald-200">x</button>
                  </span>
                  {/* Target AI Selector */}
                  <div className="flex gap-1">
                    {(['chatgpt', 'claude', 'gemini'] as const).map(target => (
                      <button
                        key={target}
                        onClick={() => setOptimizerTarget(target)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                          optimizerTarget === target
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {target === 'chatgpt' ? 'ChatGPT' : target === 'claude' ? 'Claude' : 'Gemini'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeTool && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/20">
                  <span>{activeTool.icon}</span>
                  {activeTool.name}
                  <button onClick={() => setActiveTool(null)} className="ml-1 hover:text-blue-700 dark:hover:text-blue-200">x</button>
                </span>
              )}
              {(isLiveActive || isLiveConnecting) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full border border-green-500/20">
                  <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-spin'}`} />
                  {isLiveConnecting ? 'Conectando...' : 'En Vivo'}
                  <button onClick={stopLiveConversation} className="ml-1 hover:text-green-700 dark:hover:text-green-200">x</button>
                </span>
              )}
            </div>
          )}

          {/* Image Preview Strip */}
          {selectedImages.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0 group">
                  <img
                    src={img}
                    alt={`Preview ${idx + 1}`}
                    className="w-[60px] h-[60px] rounded-xl object-cover border border-gray-200 dark:border-white/10 shadow-sm"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md transform hover:scale-110"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="w-full bg-[#f0f2f5] dark:bg-[#2A2B32] rounded-[30px] border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-500 focus-within:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] transition-all flex items-end gap-2 px-2 py-1.5 mt-1 relative">
            {/* Tools Menu (Left) */}
            <div className="relative mb-0.5 ml-0.5">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isToolsOpen ? 'bg-accent text-white shadow-md' : 'bg-white dark:bg-black/20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-sm border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'}`}
                title="Más opciones"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              {isToolsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsToolsOpen(false)}></div>
                  <div className="absolute bottom-full left-0 mb-3 w-64 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 p-1.5">
                    
                    {[
                      { id: 'live_api', label: isLiveActive ? 'Detener Conversación' : 'Conversación en Vivo', sub: isLiveActive ? 'Conectada' : 'Audio en tiempo real', icon: <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8" strokeLinecap="round" strokeLinejoin="round"/>, active: isLiveActive },
                      { id: 'image_gen', label: 'Generar Imagen', sub: 'Crea imágenes con IA', icon: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>, active: isImageGenMode },
                      { id: 'prompt_opt', label: 'Mejorar Prompt', sub: 'Optimiza para otra IA', icon: <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>, active: isPromptOptimizerMode },
                      { id: 'create_prompt', label: 'Crear Prompt', sub: 'Guarda para reusar', icon: <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8" /> },
                      { id: 'my_tools', label: 'Mis Herramientas', sub: 'Prompts guardados', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></> },
                      { id: 'attach_file', label: 'Adjuntar Archivo', sub: 'Sube imágenes', icon: <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /> }
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                          (tool as any).active ? 'bg-accent/10 dark:bg-accent/15' : 'hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className={`mt-0.5 transition-colors ${(tool as any).active ? 'text-accent' : 'text-gray-400 group-hover:text-accent'}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {tool.icon}
                          </svg>
                        </div>
                        <div>
                          <div className={`text-[13px] font-semibold ${(tool as any).active ? 'text-accent' : 'text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white'}`}>{tool.label}</div>
                          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{tool.sub}</div>
                        </div>
                        {(tool as any).active && (
                          <div className="ml-auto mt-1">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Textarea (Middle) */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={handlePaste}
              placeholder={isImageGenMode ? "Describe la imagen que quieres generar..." : isPromptOptimizerMode ? "Escribe el prompt a optimizar..." : "Mensaje a SOFLIA..."}
              className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 resize-none max-h-[160px] overflow-y-auto no-scrollbar font-sans py-2.5 px-2 leading-relaxed mb-0.5"
              rows={1}
              disabled={isLoading}
              style={{ height: '42px' }} 
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = '42px';
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }}
            />

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 pr-0.5 mb-0.5">
              {input.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                  title="Enviar mensaje"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isRecording ? 'bg-red-500 text-white shadow-md animate-pulse' : 'bg-white dark:bg-black/20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-sm border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'}`}
                  title="Dictado por voz"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Tool Editor Modal */}
      <ToolEditorModal
        isOpen={isToolEditorOpen}
        tool={editingTool}
        initialPromptText={savePromptText}
        onClose={() => { setIsToolEditorOpen(false); setEditingTool(null); setSavePromptText(''); }}
        onSave={() => { setIsToolEditorOpen(false); setEditingTool(null); setSavePromptText(''); }}
      />

      {/* Tool Library Modal */}
      <ToolLibrary
        isOpen={isToolLibraryOpen}
        onClose={() => setIsToolLibraryOpen(false)}
        onUseTool={handleUseTool}
        onEditTool={handleEditTool}
      />

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-xl transition-colors"
            onClick={() => setZoomedImage(null)}
          >
            x
          </button>
          <img
            src={zoomedImage}
            alt="Zoom"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Computer Use Confirmation Modal */}
      <ConfirmActionModal
        isOpen={!!confirmModal}
        toolName={confirmModal?.toolName || ''}
        description={confirmModal?.description || ''}
        onConfirm={() => {
          confirmModal?.resolve(true);
          setConfirmModal(null);
        }}
        onCancel={() => {
          confirmModal?.resolve(false);
          setConfirmModal(null);
        }}
      />
    </div>
  );
};

// ============================================
// Advanced Markdown Renderer
// ============================================

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden bg-[#1E1E1E] border border-white/10 shadow-sm relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-xs text-gray-400 uppercase font-mono">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="text-green-500 font-medium">Copiado</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <code className="text-[13px] leading-relaxed font-mono text-gray-200 block min-w-full whitespace-pre font-ligatures-none">{code}</code>
      </div>
    </div>
  );
};

const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Blocks
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeContent += (codeContent ? '\n' : '') + lines[i];
        i++;
      }
      elements.push(<CodeBlock key={`code-${i}`} language={language} code={codeContent} />);
      i++; // skip closing ```
      continue;
    }

    // 2. Tables
    if (line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      elements.push(<TableBlock key={`table-${i}`} rows={tableRows} />);
      continue;
    }

    // 3. Blockquotes
    if (line.startsWith('> ')) {
      const quoteContent: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteContent.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-accent bg-accent/5 py-2 px-4 my-4 rounded-r text-gray-600 dark:text-gray-400 italic">
          {quoteContent.map((q, idx) => <p key={idx} className="my-1">{formatInline(q)}</p>)}
        </blockquote>
      );
      continue;
    }

    // 4. Headers
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 0;
      const content = line.slice(level).trim();
      
      const sizes = {
        1: "text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white",
        2: "text-xl font-bold mt-5 mb-3 text-gray-900 dark:text-white",
        3: "text-lg font-semibold mt-4 mb-2 text-primary/90 dark:text-gray-100",
        4: "text-base font-semibold mt-3 mb-2 text-primary/80 dark:text-gray-200",
        5: "text-sm font-semibold mt-2 mb-1 uppercase tracking-wide text-gray-500",
        6: "text-xs font-semibold mt-2 mb-1 uppercase text-gray-500"
      };
      
      const className = sizes[level as keyof typeof sizes] || sizes[6];
      elements.push(<div key={`h-${i}`} className={className}>{formatInline(content)}</div>);
      i++;
      continue;
    }

    // 5. Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="my-6 border-gray-200 dark:border-white/10" />);
      i++;
      continue;
    }

    // 6. Lists
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
    if (listMatch) {
      // Simple handling for now - just rendering item
      // A full list parser would collect items, but for visual purposes this works reasonably well
      // provided we indent correctly.
      const indent = listMatch[1].length;
      const isOrdered = /^\d+\./.test(listMatch[2]);
      const content = line.replace(/^(\s*)([-*]|\d+\.)\s/, '');
      
      elements.push(
        <div key={`list-${i}`} className="flex gap-2 my-1" style={{ marginLeft: `${indent * 0.5}rem` }}>
           <span className={`flex-shrink-0 ${isOrdered ? 'text-accent font-medium text-xs mt-[3px]' : 'text-accent mt-1.5'}`}>
             {isOrdered ? listMatch[2] : '•'}
           </span>
           <span className="leading-relaxed">{formatInline(content)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Empty lines
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 8. Paragraphs
    elements.push(<p key={`p-${i}`} className="my-1 leading-relaxed text-gray-800 dark:text-gray-300">{formatInline(line)}</p>);
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

const TableBlock: React.FC<{ rows: string[] }> = ({ rows }) => {
  if (rows.length < 2) return null;

  // Header row
  const headerCells = rows[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
  // Body rows
  const bodyRows = rows.slice(2).map(r => r.split('|').filter(c => c.trim() !== '').map(c => c.trim()));

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200">
          <tr>
            {headerCells.map((h, idx) => (
              <th key={idx} className="px-4 py-3 font-semibold border-b border-gray-200 dark:border-white/10 whitespace-nowrap">
                {formatInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-[#1E1E1E] divide-y divide-gray-200 dark:divide-white/5">
          {bodyRows.map((r, rIdx) => (
            <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              {r.map((c, cIdx) => (
                <td key={cIdx} className="px-4 py-2.5 text-gray-700 dark:text-gray-400 border-r border-gray-200 dark:border-white/5 last:border-r-0">
                  {formatInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Simple formatter for inline markdown
function formatInline(text: string): React.ReactNode {
  if (!text) return null;
  
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    let match = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<strong key={`b-${key++}`} className="font-semibold text-gray-900 dark:text-gray-100">{formatLink(match[2], key++)}</strong>);
      remaining = match[3];
      continue;
    }
    
    // Italic: *text*
    match = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(<em key={`i-${key++}`} className="italic text-gray-700 dark:text-gray-300">{formatLink(match[2], key++)}</em>);
      remaining = match[3];
      continue;
    }

    // Code: `text`
    match = remaining.match(/^(.*?)`([^`]+)`(.*)/s);
    if (match) {
      if (match[1]) parts.push(formatLink(match[1], key++));
      parts.push(
        <code key={`c-${key++}`} className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-accent text-[13px] font-mono mx-0.5">
          {match[2]}
        </code>
      );
      remaining = match[3];
      continue;
    }

    parts.push(formatLink(remaining, key++));
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// Helper to handle links [text](url)
function formatLink(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);
    if (match) {
      if (match[1]) parts.push(match[1]);
      parts.push(
        <a 
          key={`l-${baseKey}-${key++}`} 
          href={match[3]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-accent hover:underline decoration-accent/50 underline-offset-2"
        >
          {match[2]}
        </a>
      );
      remaining = match[4];
      continue;
    }
    parts.push(remaining);
    break;
  }

  return <>{parts}</>;
}

const UserAvatar = ({ src, fallback }: { src?: string | null, fallback: React.ReactNode }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt="User"
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};
