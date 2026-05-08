import { FlowMode } from "../components/FlowMode";

interface FlowWindowRootProps {
  flowKey: number;
}

export function FlowWindowRoot({ flowKey }: FlowWindowRootProps) {
  return (
    <div className="h-screen w-screen bg-transparent flex items-end justify-center pb-0 overflow-visible border-none shadow-none">
      <FlowModeBridge flowKey={flowKey} />
    </div>
  );
}

function FlowModeBridge({ flowKey }: FlowWindowRootProps) {
  return (
    <FlowMode
      key={flowKey}
      isActive={true}
      onClose={() => (window as any).ipcRenderer.send("close-flow")}
      onSendToChat={(text: string) => {
        (window as any).ipcRenderer.send("flow-send-to-chat", text);
        (window as any).ipcRenderer.send("close-flow");
      }}
    />
  );
}
