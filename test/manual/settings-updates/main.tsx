import { integratedBrowserService } from '../../../src/services/integrated-browser-service';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UnifiedSettingsModal } from '../../../src/components/UnifiedSettingsModal';
import { UserMenu } from '../../../src/components/sidebar/UserMenu';
import { BrowserTabStrip } from '../../../src/components/browser/BrowserTabStrip';
import { BrowserAddressBar } from '../../../src/components/browser/BrowserAddressBar';
import { BrowserToolsMenu } from '../../../src/components/browser/BrowserToolsMenu';
import { HubGlyph } from '../../../src/components/ui/HubGlyph';
import { APP_VERSION } from '../../../src/shared/app-version';
import type { UpdaterStatus } from '../../../src/services/updater-service';
import '../../../src/index.css';
import '../../../src/components/browser/browser-iconography.css';

// Esta prueba sólo usa datos ficticios y un puente local sin red ni instalación.
integratedBrowserService.subscribe = () => () => {};
let status: UpdaterStatus = { state: 'idle', currentVersion: APP_VERSION, availableVersion: null, releaseNotes: null, downloadProgress: null, error: null };
window.updater = { getStatus: async () => status, checkForUpdates: async () => { status = { ...status, state: 'not-available' }; return { success: true }; }, downloadUpdate: async () => ({ success: false, error: 'Descarga simulada' }), installUpdate: async () => ({ success: false, error: 'La fixture no instala' }), onUpdateAvailable: () => () => {}, onDownloadProgress: () => () => {}, onUpdateDownloaded: () => () => {}, onError: () => () => {}, removeListeners: () => {} };
export function Fixture() {
 const [theme, setTheme] = useState<'dark'|'light'|'system'>('dark');const [open, setOpen] = useState(true);const [tab, setTab] = useState<'system'|'identity'>('system');const [tools, setTools] = useState(true);const [address,setAddress]=useState('');const [view,setView]=useState<'single'|'split'>('single');
 const changeTheme = (value: typeof theme) => { setTheme(value); document.documentElement.classList.toggle('dark',value !== 'light'); };
 return <div style={{minHeight:'100vh',padding:24,background:'var(--color-background-val)',color:'var(--color-text-main)'}}>
 <div style={{display:'flex',gap:12,marginBottom:24}}><button onClick={()=>{setTab('system');setOpen(true);}}>Ver actualizaciones</button><button onClick={()=>{setTab('identity');setOpen(true);}}>Ver personalidad</button><button onClick={()=>changeTheme(theme==='dark'?'light':'dark')}>Cambiar tema de prueba</button></div>
 <div style={{maxWidth:1100,margin:'24px auto'}}><BrowserTabStrip tabs={[{id:'home',title:'Inicio',url:'soflia://home',isLoading:false,error:null,isSuspended:false,isDetached:false}]} activeTabId="home" secondaryTabId={null} viewMode={view} onActivateTab={()=>{}} onCloseTab={()=>{}} onCreateTab={()=>{}} onSetViewMode={setView} /><div style={{display:'flex',gap:10,padding:15}}><BrowserAddressBar address={address} currentUrl="https://example.com" onAddressChange={setAddress} onEditingChange={()=>{}} onNavigate={()=>{}} /><BrowserToolsMenu open={tools} onOpenChange={setTools} sections={[[{id:'history',label:'Historial',icon:<HubGlyph name="history" size={18}/>,onSelect:()=>{}},{id:'download',label:'Descargas',icon:<HubGlyph name="download" size={18}/>,onSelect:()=>{}},{id:'bookmark',label:'Marcadores',icon:<HubGlyph name="bookmark" size={18}/>,onSelect:()=>{}}]]} /></div></div>
 <div style={{position:'absolute',left:24,bottom:24,width:292}}><UserMenu isOpen displayName="Alex" initials="A" userEmail={undefined} avatarUrl={undefined} orgName="SofLIA" orgLogoUrl={undefined} theme={theme} onSetTheme={changeTheme} onOpenSettings={()=>setOpen(true)} onSignOut={()=>{}} /></div>
 <UnifiedSettingsModal isOpen={open} onClose={()=>setOpen(false)} userId="fixture" userSettings={null} onSaveSettings={()=>{}} sofiaContext={null} apiKey="" initialTab={tab}/>
 </div>;
}
document.documentElement.classList.add('dark');createRoot(document.getElementById('root')!).render(<Fixture />);
