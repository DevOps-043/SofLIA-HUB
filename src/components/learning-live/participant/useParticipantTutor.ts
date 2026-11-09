import { useEffect, useRef, useState } from 'react';
import { askParticipantTutor, TutorPolicyError, type TutorAccess, type TutorContext, type TutorMessage } from '../../../services/participant-tutor';

export function useParticipantTutor(context: TutorContext, access?: TutorAccess) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => { running.current?.abort(); running.current = null; }, []);
  function cancel() { running.current?.abort(); running.current=null; setPending(false); setAnswer(''); }
  async function send(value = draft) {
    const question=value.trim(); if (!question || running.current) return;
    const controller = new AbortController(); running.current=controller;
    setPending(true); setError(''); setAnswer(''); setDraft(question);
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await askParticipantTutor(question,messages,context,controller.signal,text => { if (running.current===controller) setAnswer(text); },access);
      if (running.current!==controller) return;
      setMessages(previous => [...previous.slice(-38),{role:'user',text:question},{role:'model',text:response}]);
      setDraft(''); setAnswer('');
    } catch (cause) {
      if (running.current===controller) setError(controller.signal.aborted ? 'La respuesta tardó demasiado. Vuelve a intentar.' : cause instanceof TutorPolicyError ? cause.message : 'No pudimos consultar a Soflia. Revisa tu conexión y la IA configurada en Hub.');
    } finally { window.clearTimeout(timeout); if (running.current===controller) { running.current=null; setPending(false); } }
  }
  return {messages,draft,setDraft,answer,pending,error,send,cancel};
}
