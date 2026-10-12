import { memo, type FormEvent } from 'react';
import logo from '../../../public/assets/Icono.png';
import content from '../../shared/browser-home/home-content.html?raw';
import styles from '../../shared/browser-home/home.css?raw';

// Sólo contiene HTML estático del build. Ningún dato de una página, historial
// o usuario se interpola en el documento compartido con el protocolo nativo.
const markup = { __html: content.replace('__HOME_LOGO__', () => logo) };

/** Usa el Chromium ya abierto de la interfaz, sin esperar otro proceso. */
export const BrowserHomePage = memo(function BrowserHomePage({ onNavigate }: {
  onNavigate: (target: string) => void;
}) {
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
    <div className="browser-home" data-testid="browser-home" onSubmitCapture={submit} dangerouslySetInnerHTML={markup} />
  </>;
});
