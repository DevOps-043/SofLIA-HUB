
import React, { useState, useEffect, useRef } from 'react';
import { refineFlowAudio } from '../services/flow-service';

interface FlowModeProps {
  isActive: boolean;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export const FlowMode: React.FC<FlowModeProps> = ({ isActive, onClose, onSendToChat }) => {
  const [isListening, setIsListening] = useState(false);
  const [refinedText, setRefinedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Auto-start listening if active and no result yet
    if (isActive && !showResult && !isListening && !isProcessing && !errorMessage) {
      const timer = setTimeout(() => {
        toggleListening();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);
      mediaRecorderRef.current?.stop();
    } else {
      setRefinedText('');
      setShowResult(false);
      setErrorMessage('');
      
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
          
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          processAudio(audioBlob);
          
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsListening(true);
      } catch (err) {
        setErrorMessage('No se pudo acceder al micrófono.');
        console.error('Mic hardware error:', err);
      }
    }
  };

  const processAudio = async (blob: Blob) => {
    if (blob.size < 100) return; // Too short
    
    setIsProcessing(true);
    try {
      const result = await refineFlowAudio(blob);
      setRefinedText(result);
      setShowResult(true);
    } catch (err: any) {
      setErrorMessage(`Error IA: ${err.message || 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(refinedText);
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center justify-end pb-8 px-4 w-full h-full bg-transparent overflow-hidden pointer-events-none">
      
      {/* Result Popup */}
      {showResult && (
        <div className="pointer-events-auto w-full max-w-md bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-5 mb-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest">SofLIA Flow — Resultado</h3>
            <button onClick={() => setShowResult(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto custom-scrollbar mb-4 text-[13px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {refinedText}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-[12px] font-medium"
            >
              Copiar
            </button>
            <button 
              onClick={() => onSendToChat(refinedText)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors text-[12px] font-medium shadow-lg shadow-accent/20"
            >
              Usar en Chat
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div 
          onClick={() => { setErrorMessage(''); toggleListening(); }}
          className="pointer-events-auto bg-red-500 text-white text-[11px] font-bold px-4 py-1.5 rounded-full mb-3 cursor-pointer shadow-lg animate-in slide-in-from-bottom-2 duration-200 hover:scale-105 transition-transform"
        >
          {errorMessage} — Reintentar
        </div>
      )}

      {/* Control Bar */}
      <div className="pointer-events-auto flex items-center gap-4 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 px-5 py-3 rounded-full shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-white/10">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-accent animate-pulse'}`}></div>
          <span className="text-[11px] font-bold text-gray-500 dark:text-white/70 tracking-widest uppercase">Flow Mode</span>
        </div>

        <div className="flex items-center min-w-[140px]">
          {isProcessing ? (
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
               <span className="text-[12px] text-accent font-medium">Procesando...</span>
             </div>
          ) : isListening ? (
             <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }}></div>
                  ))}
                </div>
                <span className="text-[12px] text-red-500 font-medium">Grabando voz...</span>
             </div>
          ) : (
             <span className="text-[12px] text-gray-400 italic">Haz clic para dictar</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleListening}
            disabled={isProcessing}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30' : 'bg-accent text-white hover:scale-110 shadow-lg shadow-accent/20'}`}
          >
            {isListening ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8" /></svg>
            )}
          </button>

          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,212,179,0.2); border-radius: 10px; }
      `}} />
    </div>
  );
};
