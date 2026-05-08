import { REMOTE_NODE_ACTION_TOOLS } from './remote-nodes/actions';
import { REMOTE_NODE_REGISTRY_TOOLS } from './remote-nodes/registry';
import { REMOTE_NODE_SESSION_TOOLS } from './remote-nodes/sessions';

export const REMOTE_NODE_TOOLS = [
  ...REMOTE_NODE_REGISTRY_TOOLS,
  ...REMOTE_NODE_ACTION_TOOLS,
  ...REMOTE_NODE_SESSION_TOOLS,
];
