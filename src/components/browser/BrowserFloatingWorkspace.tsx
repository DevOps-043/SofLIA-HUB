import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BrowserWorkspaceLayoutProps } from './BrowserWorkspaceLayout';
import { IntegratedBrowserPanel } from './IntegratedBrowserPanel';
import { FloatingSofliaChat } from '../floating-chat/FloatingSofliaChat';
import { AgentActivityPanel } from '../agents/AgentActivityPanel';
import { useAgentActivityPanel } from '../agents/agent-activity-context';
import { integratedBrowserService } from '../../services/integrated-browser-service';
import { FloatingArtifactPreview } from '../floating-chat/FloatingArtifactPreview';
import { BrowserConversationMenu } from './BrowserConversationMenu';
import { floatingBrowserInsets, type FloatingBounds } from '../floating-chat/floating-chat-position';

export function BrowserFloatingWorkspace(props: BrowserWorkspaceLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(70), [available, setAvailable] = useState(800);
  const [pageTop,setPageTop] = useState(100), [openRequest,setOpenRequest] = useState(0);
  const [activityWidth,setActivityWidth] = useState(380);
  const [availableWidth, setAvailableWidth] = useState(1200), [dockBounds, setDockBounds] = useState<FloatingBounds | null>(null);
  const [conversationsOpen,setConversationsOpen] = useState(false);
  const activityOpen = Boolean(useAgentActivityPanel()?.open);
  const show = () => setOpenRequest(value=>value+1);
  useEffect(() => {
    if (!props.externalSelection) return;
    let active = true;
    queueMicrotask(() => { if (active) show(); });
    return () => { active = false; };
  },[props.externalSelection]);
  useEffect(() => {
    if (!integratedBrowserService.isAvailable()) return;
    return integratedBrowserService.subscribe({ onSelectionAction:show });
  },[]);
  useEffect(() => {
    const element=root.current; if (!element) return;
    const update=()=>{ const rect=element.getBoundingClientRect(); setAvailable(rect.height); setAvailableWidth(rect.width); };
    const observer=new ResizeObserver(update); observer.observe(element); update();
    return ()=>observer.disconnect();
  },[]);
  // El compositor recibe un área propia: WebContentsView no puede cubrirlo.
  const maxHeight=Math.max(150,Math.min(480,available-pageTop-150));
  const bottom=Math.min(dockHeight,maxHeight+24);
  const right=activityOpen ? activityWidth+12 : 0;
  const insets=floatingBrowserInsets(dockBounds,{width:availableWidth,height:available},pageTop,right,bottom);
  return <div ref={root} className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background dark:bg-background-dark" data-testid="browser-floating-workspace" style={{'--soflia-floating-max-height':`${maxHeight}px`} as CSSProperties}>
    <IntegratedBrowserPanel projectTarget={props.projectTarget} onClose={props.onClose}
      maximized onToggleMaximize={show} onShowChat={show} chatVisible={false}
      viewportInsets={insets} onContentTopChange={setPageTop} />
    <div className="absolute inset-0 pointer-events-none" style={{right}} data-native-browser-overlay={insets.occluded ? 'true' : undefined}><div className="pointer-events-auto"><FloatingSofliaChat title={props.floatingTitle} onPrepare={props.onPrepareFloating} onNewChat={props.onNewChat} openRequest={openRequest} onHeightChange={setDockHeight} onBoundsChange={setDockBounds}
      navigation={<BrowserConversationMenu inline showNewChat={false} conversations={props.conversations} currentConversationId={props.currentConversationId} open={conversationsOpen} onOpenChange={setConversationsOpen} onNewChat={props.onNewChat} onSelectConversation={props.onSelectConversation} />}>{props.chat}</FloatingSofliaChat></div></div>
    <FloatingArtifactPreview />
    <AgentActivityPanel className="absolute z-30 rounded-[1.25rem] border border-border" style={{top:pageTop+6,bottom:6,right:6}} onWidthChange={setActivityWidth} />
  </div>;
}
