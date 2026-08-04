import { CHANNEL_GROUP_1 } from './channel-group-1';
import { CHANNEL_GROUP_2 } from './channel-group-2';
import { CHANNEL_GROUP_3 } from './channel-group-3';
import { CHANNEL_GROUP_4 } from './channel-group-4';
import { CHANNEL_GROUP_5 } from './channel-group-5';

export const ALLOWED_IPC_CHANNELS = [
  ...CHANNEL_GROUP_1,
  ...CHANNEL_GROUP_2,
  ...CHANNEL_GROUP_3,
  ...CHANNEL_GROUP_4,
  ...CHANNEL_GROUP_5,
] as const;

export type AllowedIpcChannel = typeof ALLOWED_IPC_CHANNELS[number];
