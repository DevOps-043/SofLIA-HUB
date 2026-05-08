import { BrowserWindow } from 'electron';

export async function fetchFocusedAccessibilityTree(): Promise<string | null> {
  try {
    const windows = BrowserWindow.getAllWindows();
    const activeWindow = windows.find((window) => window.isFocused()) || windows[0];
    if (!activeWindow) return null;

    const wc = activeWindow.webContents;
    let attachedHere = false;
    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3');
      attachedHere = true;
    }

    const response = await wc.debugger.sendCommand('Accessibility.getFullAXTree');
    if (attachedHere) wc.debugger.detach();

    const nodes = response?.nodes || [];
    if (nodes.length === 0) return null;

    const nodeMap = new Map<string, any>();
    for (const node of nodes) nodeMap.set(node.nodeId, node);

    const rootNode = nodes.find((node: any) => node.role?.value === 'RootWebArea') || nodes[0];
    const simplifiedTree = rootNode
      ? buildSimplifiedTree(rootNode.nodeId, nodeMap)
      : nodes
        .filter((node: any) => !node.ignored && (node.role?.value || node.name?.value))
        .map((node: any) => ({ role: node.role?.value, name: node.name?.value }));

    return simplifiedTree ? JSON.stringify(simplifiedTree) : null;
  } catch (err: any) {
    console.error('[MonitoringService] fetchAXTree error:', err.message);
    return null;
  }
}

function buildSimplifiedTree(nodeId: string, nodeMap: Map<string, any>): any {
  const node = nodeMap.get(nodeId);
  if (!node || node.ignored) return null;

  const simplified = buildNodeSummary(node);
  if (node.childIds?.length > 0) {
    const children = node.childIds
      .map((childId: string) => buildSimplifiedTree(childId, nodeMap))
      .filter((child: any) => child !== null);
    if (children.length > 0) simplified.children = children;
  }

  if (Object.keys(simplified).length === 0 && !simplified.children) return null;
  return simplified;
}

function buildNodeSummary(node: any): Record<string, any> {
  const role = node.role?.value;
  const name = node.name?.value;
  const value = node.value?.value;
  const props: Record<string, any> = {};

  for (const prop of node.properties || []) {
    if (prop.value?.value !== undefined && prop.value?.value !== '') {
      props[prop.name] = prop.value.value;
    }
  }

  const summary: Record<string, any> = {};
  if (role && role !== 'generic') summary.role = role;
  if (name) summary.name = name;
  if (value) summary.value = value;
  if (Object.keys(props).length > 0) summary.props = props;
  return summary;
}
