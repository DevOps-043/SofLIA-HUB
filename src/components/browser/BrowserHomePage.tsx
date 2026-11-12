import { memo, useCallback, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { SofliaAvatar } from '../avatar/SofliaAvatar';
import { draftExpression } from '../avatar/avatar-reactions';
import content from '../../shared/browser-home/home-content.html?raw';
import styles from '../../shared/browser-home/home.css?raw';

// Sólo contiene HTML estático del build. Ningún dato de una página, historial
// o usuario se interpola en el documento compartido con el protocolo nativo.
const markup = { __html: content.replace('__HOME_AVATAR__', '<div data-home-avatar-host style="width:100%;height:100%"></div>') };

/** Usa el Chromium ya abierto de la interfaz, sin esperar otro proceso. */
export const BrowserHomePage = memo(function BrowserHomePage({ onNavigate }: {
  onNavigate: (target: string) => void;
}) {
  const [queryDraft, setQueryDraft] = useState('');
  const [avatarHost, setAvatarHost] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => { setAvatarHost(element?.querySelector('[data-home-avatar-host]') ?? null); }, []);
  const submit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const query = new FormData(form).get('q');
    if (typeof query !== 'string' || !query.trim()) return;
    onNavigate(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`);
  };
  return <>
    <style>{styles}</style>
    <div ref={attach} onInputCapture={event => { if (event.target instanceof HTMLInputElement && event.target.name === 'q') setQueryDraft(event.target.value); }} className="browser-home" data-testid="browser-home" onSubmitCapture={submit} dangerouslySetInnerHTML={markup} />
    {avatarHost && createPortal(<SofliaAvatar expression={draftExpression(queryDraft)} />, avatarHost)}
  </>;
});
