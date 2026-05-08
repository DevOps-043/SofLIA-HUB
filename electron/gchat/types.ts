export interface ChatSpace {
  name: string;
  displayName: string;
  type: 'ROOM' | 'DM' | 'GROUP_CHAT' | string;
  spaceThreadingState?: string;
  spaceType?: string;
  spaceUri?: string;
  lastActiveTime?: string;
  singleUserBotDm?: boolean;
  joinedDirectHumanUserCount?: number;
}

export interface ChatMessage {
  name: string;
  sender: { name: string; displayName: string; email?: string };
  createTime: string;
  text: string;
  threadName?: string;
  urls?: string[];
}
