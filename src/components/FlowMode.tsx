import React, { useState, useEffect, useRef } from 'react';
import { refineFlowText, GroundingSource, transcribeAudio } from '../services/flow-service';
import { LiveClient, AudioCapture } from '../services/live-api';

interface FlowModeProps {
  isActive: boolean;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export const FlowMode: React.FC<FlowModeProps> = ({ isActive, onClose, onSendToChat }) => {
  const [inputText, setInputText] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  
  const liveClientRef = useRef<LiveClient | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when response updates
  useEffect(() => {
    if (resultContainerRef.current) {
      resultContainerRef.current.scrollTop = resultContainerRef.current.scrollHeight;
    }
  }, [aiResponse]);

  // Cleanup
  useEffect(() => {
    if (!isActive) stopLiveSession();
    return () => stopLiveSession();
  }, [isActive]);

  const stopLiveSession = () => {
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stop();
      audioCaptureRef.current = null;
    }
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
    setIsLiveActive(false);
  };

  const captureScreenshot = async () => {
    try {
      if ((window as any).screenCapture) {
        return await (window as any).screenCapture.captureScreen();
      }
    } catch (err) {
      console.error("Error capturing screen:", err);
    }
    return undefined;
  };

  const startDictation = async () => {
    try {
      setErrorMessage('');
      setIsDictating(true);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        setIsDictating(false); // Moved outside the if block to ensure it's always set to false
        if (audioBlob.size < 1000) {
          // If audio is too short, we still want to process it, but maybe with a different message or no transcription.
          // The instruction implies a direct flow, so we'll proceed with processing even short audio.
        }

        setIsProcessing(true);
        try {
          const screenshot = await captureScreenshot();
          const transcript = await transcribeAudio(audioBlob);
          
          if (transcript && transcript.trim().length > 0) {
            setUserQuery(transcript);
            setAiResponse('Pensando...');
            setShowResult(true);
            
            try {
              const result = await refineFlowText(transcript, screenshot);
              setAiResponse(result.text);
              if (result.sources) setGroundingSources(result.sources);
            } catch (refineErr) {
              console.error("Refinement error:", refineErr);
              setAiResponse("Hubo un error al procesar la respuesta."); // Updated error message
            }
          } else {
            // Handle case where transcript is empty or null
            setAiResponse("No se detectó voz o el audio es muy corto.");
            setShowResult(true);
          }
        } catch (err: any) {
          console.error("Transcription error:", err);
          setErrorMessage("Error al procesar audio.");
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(t => t.stop());
        }
      };

      mediaRecorderRef.current.start();
    } catch (err: any) {
      setErrorMessage("Error de micrófono.");
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsDictating(false);
  };

  const handleMicAction = () => {
    if (isLiveActive) stopLiveSession();
    else if (isDictating) stopDictation();
    else startDictation();
  };

  const handleManualTextSubmit = async () => {
    if (!inputText.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setErrorMessage('');
    setUserQuery(inputText);
    setAiResponse('Analizando...');
    setShowResult(true);
    setInputText('');
    setIsInputExpanded(false);
    
    try {
      const screenshot = await captureScreenshot();
      const result = await refineFlowText(inputText, screenshot);
      setAiResponse(result.text);
      if (result.sources) setGroundingSources(result.sources);
    } catch (err: any) {
      setAiResponse(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderResult = () => {
    return (
      <div className="flex flex-col gap-6 font-sans">
        {userQuery && (
          <div className="group relative pl-4 border-l-2 border-accent/20">
            <div className="text-[11px] font-medium text-gray-500/60 uppercase tracking-widest mb-1.5">Tu entrada</div>
            <div className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
              "{userQuery}"
            </div>
          </div>
        )}
        
        <div className="relative">
          <div className="text-[11px] font-bold text-accent uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            Respuesta
          </div>
          <div className="text-[14px] text-gray-800 dark:text-gray-200 leading-[1.6] font-medium whitespace-pre-wrap">
            {aiResponse}
          </div>
        </div>

        {groundingSources.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Referencias</div>
            <div className="flex flex-wrap gap-2">
              {groundingSources.map((source, i) => (
                <a 
                  key={i} 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-all no-underline group/link"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600 group-hover/link:bg-accent transition-colors"></div>
                  <span className="text-[10px] font-bold text-gray-400 group-hover/link:text-accent transition-colors truncate max-w-40">{source.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleManualTextSubmit();
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-end justify-end pb-0 px-8 w-full h-full bg-transparent pointer-events-none font-sans overflow-hidden">
      
      {showResult && (
        <div className="pointer-events-auto w-[460px] bg-zinc-950 dark:bg-[#080808] border border-white/10 rounded-[32px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] p-0 mb-8 animate-in slide-in-from-right-12 fade-in duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shrink-0 ml-auto mr-[-16px] relative overflow-hidden group">
          {/* Accent Line */}
          <div className="absolute top-0 right-0 w-1/2 h-[1px] bg-gradient-to-l from-accent/40 to-transparent"></div>
          
          {/* Header */}
          <div className="flex justify-between items-center px-8 pt-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <span className="text-[12px] font-bold text-gray-300 tracking-wider">SofLIA Insight</span>
            </div>
            <button 
              onClick={() => { setShowResult(false); setUserQuery(''); setAiResponse(''); setGroundingSources([]); }} 
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 text-gray-500 hover:text-white transition-all active:scale-90"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>

          {/* Body */}
          <div 
            ref={resultContainerRef} 
            className="max-h-[55vh] min-h-[120px] overflow-y-auto custom-scrollbar px-8 py-2 mb-4"
          >
            {renderResult()}
          </div>

          {/* Footer / Actions */}
          <div className="px-8 pb-8 pt-4 flex items-center justify-between border-t border-white/5 bg-black/20">
            <button 
              onClick={() => aiResponse && navigator.clipboard.writeText(aiResponse)} 
              className="flex items-center gap-2 group/copy"
            >
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 group-hover/copy:bg-accent/10 group-hover/copy:text-accent text-gray-500 transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </div>
              <span className="text-[11px] font-bold text-gray-500 group-hover/copy:text-gray-300 transition-colors uppercase tracking-widest">Copiar</span>
            </button>

            <button 
              onClick={() => { 
                if (aiResponse) { 
                  onSendToChat(aiResponse); 
                  setShowResult(false); 
                } 
              }} 
              className="px-8 py-3 rounded-2xl bg-accent hover:brightness-110 text-black font-extrabold text-[12px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-accent/20"
            >
              Integrar en Chat
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div onClick={() => setErrorMessage('')} className="pointer-events-auto bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold px-6 py-2.5 rounded-full mb-4 cursor-pointer shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 ml-auto border border-white/10">
          {errorMessage}
        </div>
      )}

      <div className="w-full flex justify-center pb-2">
        <div className={`pointer-events-auto flex items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] bg-white/60 dark:bg-[#0A0A0A]/60 backdrop-blur-xl border border-white/10 dark:border-white/5 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.3)] relative overflow-hidden ${isInputExpanded ? 'w-full max-w-lg px-4 py-1.5 rounded-2xl' : 'w-fit px-1.5 py-1.5 rounded-full'}`}>
          <div className="flex items-center w-full gap-1">
            {/* Toggle Arrow */}
            <button 
              onClick={() => {
                setIsInputExpanded(!isInputExpanded);
                if (!isInputExpanded) setTimeout(() => textareaRef.current?.focus(), 100);
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-accent ${isInputExpanded ? 'rotate-180' : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>

            {/* Input Field (Visible when expanded) */}
            <div className={`flex-1 flex items-center transition-all duration-500 overflow-hidden ${isInputExpanded ? 'opacity-100 ml-2' : 'opacity-0 w-0 pointer-events-none'}`}>
              <textarea 
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Escribe algo..."
                className="w-full bg-transparent border-none outline-none text-[13px] text-gray-800 dark:text-gray-200 placeholder-gray-400/40 dark:placeholder-white/10 py-1.5 resize-none max-h-25 custom-scrollbar font-medium"
              />
              {inputText.trim() && (
                <button onClick={handleManualTextSubmit} disabled={isProcessing} className="p-1.5 rounded-lg bg-accent text-white shadow-sm transition-all active:scale-90 ml-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              )}
            </div>

            {/* Mic and Close */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={handleMicAction} disabled={isProcessing} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${(isLiveActive || isDictating) ? 'bg-red-500/90 text-white shadow-md' : 'text-gray-400 dark:text-gray-500 hover:text-accent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                {(isLiveActive || isDictating) ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8" /></svg>
                )}
              </button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-500/5 transition-all duration-300 active:scale-90">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M18 6L6 18M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,212,179,0.15); border-radius: 10px; }
      `}} />
    </div>
  );
};
