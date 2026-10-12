import { createRoot } from 'react-dom/client';
import { PresentationPlayerApp } from './PresentationPlayerApp';
import './standalone.css';

createRoot(document.getElementById('root')!).render(<PresentationPlayerApp />);
