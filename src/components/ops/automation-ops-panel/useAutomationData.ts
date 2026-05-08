import { useCallback, useMemo, useState } from 'react';
import { listAutomationRuns, listAutomationTemplates, type WorkflowRunRecord, type WorkflowTemplateDefinition } from '../../../services/automation-service';
import { listGChatSpaces, type ChatSpace } from '../../../services/gchat-service';
import { getRemoteNodeHostStatus, listRemoteNodes, type RemoteNodeHostStatus, type RemoteNodeRecord } from '../../../services/remote-node-service';
import { getTelegramStatus, listTelegramRecentChats, type TelegramRecentChat, type TelegramStatusSnapshot } from '../../../services/telegram-service';
import type { BridgeAvailability } from './types';

export function useAutomationData(
  bridge: BridgeAvailability,
  hydrateTelegram: (status: TelegramStatusSnapshot) => void,
) {
  const [templates, setTemplates] = useState<WorkflowTemplateDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusSnapshot | null>(null);
  const [recentChats, setRecentChats] = useState<TelegramRecentChat[]>([]);
  const [hostStatus, setHostStatus] = useState<RemoteNodeHostStatus | null>(null);
  const [nodes, setNodes] = useState<RemoteNodeRecord[]>([]);
  const [telegramHydrated, setTelegramHydrated] = useState(false);

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) || null, [runs, selectedRunId]);
  const customTemplates = useMemo(() => templates.filter((template) => template.kind === 'custom'), [templates]);
  const selectedCustomTemplate = useMemo(() => customTemplates.find((template) => template.id === selectedCustomTemplateId) || null, [customTemplates, selectedCustomTemplateId]);
  const pendingRuns = useMemo(() => runs.filter((run) => run.status === 'needs_approval'), [runs]);

  const refreshOverview = useCallback(async (preserveSelection = true) => {
    const tasks: Array<Promise<void>> = [];

    if (bridge.automation) {
      tasks.push((async () => {
        const result = await listAutomationTemplates();
        if (!result.success) throw new Error(result.error || 'No pude cargar los flujos.');
        const nextTemplates = result.templates || [];
        setTemplates(nextTemplates);
        setSelectedCustomTemplateId((current) => current && nextTemplates.some((template) => template.id === current && template.kind === 'custom') ? current : nextTemplates.find((template) => template.kind === 'custom')?.id || null);
      })());
      tasks.push((async () => {
        const result = await listAutomationRuns(30);
        if (!result.success) throw new Error(result.error || 'No pude cargar los casos.');
        const nextRuns = result.runs || [];
        setRuns(nextRuns);
        setSelectedRunId((current) => preserveSelection && current && nextRuns.some((run) => run.id === current) ? current : nextRuns[0]?.id || null);
      })());
    }

    if (bridge.gchat) {
      tasks.push(listGChatSpaces().then((result) => {
        if (result.success) setSpaces(result.spaces || []);
      }));
    }

    if (bridge.telegram) {
      tasks.push((async () => {
        const [statusResult, chatsResult] = await Promise.all([getTelegramStatus(), listTelegramRecentChats()]);
        if (!statusResult.success) throw new Error(statusResult.error || 'No pude cargar Telegram.');
        setTelegramStatus(statusResult);
        setRecentChats(chatsResult.success ? (chatsResult.chats || []) : []);
        if (!telegramHydrated) {
          hydrateTelegram(statusResult);
          setTelegramHydrated(true);
        }
      })());
    }

    if (bridge.remoteNode) {
      tasks.push((async () => {
        const [hostResult, nodesResult] = await Promise.all([getRemoteNodeHostStatus(), listRemoteNodes()]);
        setHostStatus(hostResult);
        if (!nodesResult.success) throw new Error(nodesResult.error || 'No pude cargar nodos.');
        setNodes(nodesResult.nodes || []);
      })());
    }

    await Promise.all(tasks);
  }, [bridge.automation, bridge.gchat, bridge.remoteNode, bridge.telegram, hydrateTelegram, telegramHydrated]);

  return { templates, runs, selectedRun, selectedRunId, setSelectedRunId, customTemplates, selectedCustomTemplate, selectedCustomTemplateId, setSelectedCustomTemplateId, pendingRuns, spaces, telegramStatus, setTelegramStatus, recentChats, hostStatus, setHostStatus, nodes, refreshOverview };
}
