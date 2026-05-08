import { useCallback, useMemo, useState } from 'react';
import type { TelegramStatusSnapshot } from '../../../services/telegram-service';
import { getEffectiveTriageQuery } from './formatters';
import type { ActiveAutomationAction, RemoteImageState, TriagePresetId } from './types';

export function useAutomationFormState() {
  const [triagePreset, setTriagePreset] = useState<TriagePresetId>('unread');
  const [triageQuery, setTriageQuery] = useState('');
  const [triageMaxResults, setTriageMaxResults] = useState(5);
  const [triageChatSpace, setTriageChatSpace] = useState('');
  const [briefDate, setBriefDate] = useState(new Date().toISOString().slice(0, 10));
  const [briefChatSpace, setBriefChatSpace] = useState('');
  const [followupTo, setFollowupTo] = useState('');
  const [followupTopic, setFollowupTopic] = useState('');
  const [followupContext, setFollowupContext] = useState('');
  const [meetingPrepDate, setMeetingPrepDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingPrepChatSpace, setMeetingPrepChatSpace] = useState('');
  const [driveProjectName, setDriveProjectName] = useState('');
  const [driveParentFolderId, setDriveParentFolderId] = useState('');
  const [driveChatSpace, setDriveChatSpace] = useState('');
  const [executiveChatSpace, setExecutiveChatSpace] = useState('');
  const [executiveContext, setExecutiveContext] = useState('');
  const [executiveTone, setExecutiveTone] = useState('ejecutivo y claro');
  const [desktopObjective, setDesktopObjective] = useState('');
  const [desktopBackend, setDesktopBackend] = useState('auto');
  const [desktopStartUrl, setDesktopStartUrl] = useState('');
  const [customFlowName, setCustomFlowName] = useState('');
  const [customFlowObjective, setCustomFlowObjective] = useState('');
  const [customFlowDetails, setCustomFlowDetails] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramAllowedChats, setTelegramAllowedChats] = useState('');
  const [telegramPollInterval, setTelegramPollInterval] = useState(8000);
  const [nodeName, setNodeName] = useState('');
  const [nodeBaseUrl, setNodeBaseUrl] = useState('http://127.0.0.1:47825');
  const [nodeToken, setNodeToken] = useState('');
  const [remoteImage, setRemoteImage] = useState<RemoteImageState | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAutomationAction>('triage');
  const effectiveTriageQuery = useMemo(
    () => getEffectiveTriageQuery(triagePreset, triageQuery),
    [triagePreset, triageQuery],
  );
  const hydrateTelegram = useCallback((status: TelegramStatusSnapshot) => {
    setTelegramEnabled(status.enabled);
    setTelegramAllowedChats((status.allowed_chat_ids || []).join(', '));
    setTelegramPollInterval(status.poll_interval_ms || 8000);
  }, []);

  return {
    triage: { preset: triagePreset, setPreset: setTriagePreset, query: triageQuery, setQuery: setTriageQuery, maxResults: triageMaxResults, setMaxResults: setTriageMaxResults, chatSpace: triageChatSpace, setChatSpace: setTriageChatSpace, effectiveQuery: effectiveTriageQuery },
    brief: { date: briefDate, setDate: setBriefDate, chatSpace: briefChatSpace, setChatSpace: setBriefChatSpace },
    followup: { to: followupTo, setTo: setFollowupTo, topic: followupTopic, setTopic: setFollowupTopic, context: followupContext, setContext: setFollowupContext },
    meeting: { date: meetingPrepDate, setDate: setMeetingPrepDate, chatSpace: meetingPrepChatSpace, setChatSpace: setMeetingPrepChatSpace },
    drive: { projectName: driveProjectName, setProjectName: setDriveProjectName, parentFolderId: driveParentFolderId, setParentFolderId: setDriveParentFolderId, chatSpace: driveChatSpace, setChatSpace: setDriveChatSpace },
    executive: { chatSpace: executiveChatSpace, setChatSpace: setExecutiveChatSpace, context: executiveContext, setContext: setExecutiveContext, tone: executiveTone, setTone: setExecutiveTone },
    desktop: { objective: desktopObjective, setObjective: setDesktopObjective, backend: desktopBackend, setBackend: setDesktopBackend, startUrl: desktopStartUrl, setStartUrl: setDesktopStartUrl },
    custom: { name: customFlowName, setName: setCustomFlowName, objective: customFlowObjective, setObjective: setCustomFlowObjective, details: customFlowDetails, setDetails: setCustomFlowDetails },
    telegram: { enabled: telegramEnabled, setEnabled: setTelegramEnabled, token: telegramToken, setToken: setTelegramToken, allowedChats: telegramAllowedChats, setAllowedChats: setTelegramAllowedChats, pollInterval: telegramPollInterval, setPollInterval: setTelegramPollInterval, hydrate: hydrateTelegram },
    remoteNode: { name: nodeName, setName: setNodeName, baseUrl: nodeBaseUrl, setBaseUrl: setNodeBaseUrl, token: nodeToken, setToken: setNodeToken, image: remoteImage, setImage: setRemoteImage },
    action: { active: activeAction, setActive: setActiveAction },
  };
}
