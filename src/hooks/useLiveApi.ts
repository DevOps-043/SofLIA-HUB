import { useState, useRef, useEffect } from 'react';
import { LiveClient, AudioCapture } from '../services/live-api';
import type { ChatMessage } from '../services/chat-service';

interface UseLiveApiParams {
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export function useLiveApi({ messagesRef, onMessagesChange }: UseLiveApiParams) {
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const liveClientRef = useRef<LiveClient | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);

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

      const capture = new AudioCapture();
      await capture.start((base64) => {
        client.sendAudioChunk(base64);
      });
      audioCaptureRef.current = capture;
    } catch (err: unknown) {
      console.error('Live API connect error:', err);
      setIsLiveConnecting(false);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: `**Error**: ${err instanceof Error ? err.message : 'Error desconocido'}`,
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

  return {
    isLiveActive,
    isLiveConnecting,
    liveClientRef,
    startLiveConversation,
    stopLiveConversation,
  };
}
