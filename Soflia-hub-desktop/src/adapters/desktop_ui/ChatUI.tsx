import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sendMessageStream } from '../../services/gemini-chat';
import type { ChatMessage } from '../../services/chat-service';

interface ChatUIProps {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export const ChatUI: React.FC<ChatUIProps> = ({ messages, onMessagesChange }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    const aiMessageId = crypto.randomUUID();
    const aiPlaceholder: ChatMessage = {
      id: aiMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage, aiPlaceholder];
    onMessagesChange(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Preparar historial (sin el placeholder)
      const history = [...messages, userMessage].map(m => ({
        role: m.role,
        text: m.text,
      }));

      const result = await sendMessageStream(input.trim(), history);

      let fullText = '';
      for await (const chunk of result.stream) {
        fullText += chunk;
        onMessagesChange(
          updatedMessages.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: fullText } : msg
          )
        );
      }

      // Agregar sources si hay
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
    }
  }, [input, isLoading, messages, onMessagesChange]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark">

      {/* Empty State */}
      {messages.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-accent">L</span>
            </div>
            <h2 className="text-2xl font-semibold text-primary dark:text-white text-center">
              Como puedo ayudarte hoy?
            </h2>
            <p className="text-secondary text-sm text-center mt-2">
              Preguntale a LIA lo que necesites.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {(messages.length > 0 || isLoading) && (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* Assistant Avatar */}
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-accent">L</span>
                  </div>
                )}

                <div className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-2xl rounded-br-sm px-4 py-3'
                    : 'text-primary dark:text-gray-100 pt-1'
                }`}>
                  {msg.role === 'model' ? (
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                      <MarkdownRenderer text={msg.text} />
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                          </svg>
                          {source.title || 'Source'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary dark:text-white">U</span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'model' && messages[messages.length - 1].text === '' && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-accent">L</span>
                </div>
                <div className="flex items-center gap-1.5 pt-2">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-100 dark:border-white/10 bg-background dark:bg-background-dark">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="relative flex items-center bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none placeholder-gray-400 text-primary dark:text-white"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="mr-2 p-2 bg-primary hover:bg-primary/90 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a1 1 0 01-1-1V5.414L5.707 8.707a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0l5 5a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 01-1 1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            LIA esta impulsada por Gemini. Las respuestas pueden no ser siempre precisas.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Simple Markdown Renderer
// ============================================

const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeContent = '';
      } else {
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs my-3">
            {codeLang && <div className="text-gray-500 text-[10px] mb-2 uppercase">{codeLang}</div>}
            <code>{codeContent}</code>
          </pre>
        );
        inCodeBlock = false;
        codeContent = '';
        codeLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-2">{formatInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-4 mb-2">{formatInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-4 mb-2">{formatInline(line.slice(2))}</h1>);
      continue;
    }

    // List items
    if (line.match(/^\s*[-*]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-accent mt-0.5">-</span>
          <span>{formatInline(line.replace(/^\s*[-*]\s/, ''))}</span>
        </div>
      );
      continue;
    }
    if (line.match(/^\s*\d+\.\s/)) {
      const num = line.match(/^\s*(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-accent font-medium min-w-[1.2em]">{num}.</span>
          <span>{formatInline(line.replace(/^\s*\d+\.\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Normal paragraph
    elements.push(<p key={i} className="my-1">{formatInline(line)}</p>);
  }

  // Close unclosed code block
  if (inCodeBlock && codeContent) {
    elements.push(
      <pre key="code-end" className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs my-3">
        <code>{codeContent}</code>
      </pre>
    );
  }

  return <>{elements}</>;
};

/**
 * Formatea inline markdown: **bold**, `code`, *italic*
 */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(formatCode(boldMatch[1], key++));
      parts.push(<strong key={`b-${key++}`}>{formatCode(boldMatch[2], key++)}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // No more formatting
    parts.push(formatCode(remaining, key++));
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function formatCode(text: string, baseKey: number): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`c-${baseKey}-${i}`} className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-accent text-[13px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
